/**
 * Database Migration Runner
 *
 * Concept: Database Migrations
 * ────────────────────────────────────────────────────────────────────
 * Migrations are versioned, atomic transformations of database schema.
 * They provide version control for your database structure, just like
 * git provides version control for your application code.
 *
 * Key Properties:
 * ────────────────────────────────────────────────────────────────────
 * 1. VERSIONED - Timestamp-prefixed filenames ensure chronological order
 * 2. ATOMIC - Wrapped in transactions (all-or-nothing execution)
 * 3. ONE-WAY - Applied once, never re-run (tracked in schema_migrations)
 * 4. IDEMPOTENT - Safe to run migration runner multiple times
 *
 * How It Works:
 * ────────────────────────────────────────────────────────────────────
 * 1. Check schema_migrations table to see what's already applied
 * 2. Read all .sql files from migrations/ directory
 * 3. Diff: Which migrations are pending? (filesystem - database)
 * 4. Execute each pending migration in a transaction
 * 5. Mark successful migrations in schema_migrations table
 * 6. Rollback if any migration fails (preserves database consistency)
 *
 * Why Transactions?
 * ────────────────────────────────────────────────────────────────────
 * Transactions guarantee ATOMICITY (the "A" in ACID):
 *
 * WITHOUT TRANSACTION:
 *   CREATE TABLE notifications (...);  ✅ Succeeds
 *   ALTER TABLE users ADD bio;         ✅ Succeeds
 *   CREATE INDEX bad_syntax;           ❌ FAILS
 *   → Result: Partial application, database in inconsistent state
 *
 * WITH TRANSACTION:
 *   BEGIN TRANSACTION;
 *     CREATE TABLE notifications (...);  ✅ Succeeds
 *     ALTER TABLE users ADD bio;         ✅ Succeeds
 *     CREATE INDEX bad_syntax;           ❌ FAILS
 *   ROLLBACK; -- Entire transaction undone
 *   → Result: Database unchanged, consistent state preserved
 *
 * Real-World Impact:
 * ────────────────────────────────────────────────────────────────────
 * ✅ Automated deployments (no manual SQL execution)
 * ✅ Team coordination (everyone runs same migrations)
 * ✅ Audit trail (know exactly when schema changed)
 * ✅ Staging/production parity (identical schema evolution)
 * ✅ Fail-fast (app won't start with broken migration)
 */

import { Database } from "sqlite3";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import type { FastifyBaseLogger } from "fastify";

// ESM module resolution (get current directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Track which migrations have been applied
 */
interface Migration {
  version: string;
  applied_at: string;
}

/**
 * Promisified database.run() - Executes SQL with no return value
 *
 * Why promisify? SQLite's native API is callback-based:
 *   db.run(sql, (err) => { ... })
 *
 * Wrapping in Promise allows us to use async/await:
 *   await dbRun(db, sql)
 *
 * This makes our migration runner code much cleaner and easier to reason about.
 */
function dbRun(db: Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Promisified database.exec() - Executes multiple SQL statements
 *
 * Critical Difference from db.run():
 * - db.run()  → Executes ONE statement only
 * - db.exec() → Executes MULTIPLE semicolon-separated statements
 *
 * Migration files often contain many statements:
 *   CREATE TABLE users (...);
 *   CREATE TABLE tokens (...);
 *   CREATE INDEX idx_user_id (...);
 *
 * We need exec() to handle all of them in one call.
 *
 * Note: exec() doesn't support parameterized queries, but that's fine
 * because migration SQL is controlled by us (not user input).
 */
function dbExec(db: Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Promisified database.all() - Fetches all rows matching query
 */
function dbAll<T>(db: Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

/**
 * Run all pending database migrations
 *
 * This function is called once during application startup (in databasePlugin.ts).
 * It ensures the database schema is up-to-date before the application serves requests.
 *
 * Flow:
 * ─────
 * 1. Create schema_migrations tracking table (if not exists)
 * 2. Query which migrations have already been applied
 * 3. Read migration files from filesystem
 * 4. Calculate pending migrations (filesystem minus database)
 * 5. Execute each pending migration in a transaction
 * 6. Log progress and fail fast on errors
 *
 * @param db - SQLite database instance
 * @param logger - Fastify logger instance for consistent logging
 * @throws Error if any migration fails (includes rollback confirmation)
 */
export async function runMigrations(db: Database, logger: FastifyBaseLogger): Promise<void> {
  logger.info("🔄 Starting database migration check...");

  // ══════════════════════════════════════════════════════════════════
  // STEP 1: Create Migration Tracking Table
  // ══════════════════════════════════════════════════════════════════
  // This table records which migrations have been applied.
  // Structure:
  //   version     | applied_at
  //   ─────────────────────────────────────────────
  //   20241111... | 2024-11-11 12:00:00
  //   20241112... | 2024-11-12 09:30:00
  //
  // Why IF NOT EXISTS? On first run, table doesn't exist. On subsequent
  // runs, it does. This makes the operation idempotent.

  await dbRun(
    db,
    `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  );

  // ══════════════════════════════════════════════════════════════════
  // STEP 2: Get List of Already-Applied Migrations
  // ══════════════════════════════════════════════════════════════════
  // Query the tracking table to see what we've already run.
  // We order by version to make logs chronological.

  const appliedMigrations = await dbAll<Migration>(
    db,
    "SELECT version FROM schema_migrations ORDER BY version"
  );

  // Convert array to Set for O(1) lookup performance
  // Why? We'll be checking "has this migration been applied?" many times.
  // Array.includes() is O(n), Set.has() is O(1).
  const appliedSet = new Set(appliedMigrations.map((m) => m.version));

  logger.info(`📋 Found ${appliedMigrations.length} previously applied migrations`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 3: Read Migration Files from Filesystem
  // ══════════════════════════════════════════════════════════════════
  // Read all .sql files from the migrations/ directory.
  // They're sorted alphabetically (which is chronological due to timestamp prefix).
  //
  // Example directory contents:
  //   20241111000000_initial_schema.sql
  //   20241111120000_add_user_bio.sql
  //   20241112090000_add_notifications.sql

  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // Chronological order via timestamp prefix

  // ══════════════════════════════════════════════════════════════════
  // STEP 4: Calculate Pending Migrations
  // ══════════════════════════════════════════════════════════════════
  // Pending = files on disk that aren't in schema_migrations table
  //
  // Example:
  //   Files:   [20241111000000, 20241111120000, 20241112090000]
  //   Applied: [20241111000000, 20241111120000]
  //   Pending: [20241112090000]

  const pendingMigrations = files.filter((file) => {
    const version = file.replace(".sql", "");
    return !appliedSet.has(version);
  });

  if (pendingMigrations.length === 0) {
    logger.info("✅ Database schema is up-to-date");
    return;
  }

  logger.info(`📦 Found ${pendingMigrations.length} pending migration(s)`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 5: Apply Each Pending Migration
  // ══════════════════════════════════════════════════════════════════
  // Execute migrations ONE AT A TIME in chronological order.
  // Each migration is wrapped in a transaction for atomicity.

  for (const file of pendingMigrations) {
    const version = file.replace(".sql", "");
    logger.info(`  ⏳ Applying migration: ${file}`);

    // Read the SQL from the file
    const sql = readFileSync(join(migrationsDir, file), "utf-8");

    // ────────────────────────────────────────────────────────────────
    // BEGIN TRANSACTION
    // ────────────────────────────────────────────────────────────────
    // Everything between BEGIN and COMMIT is atomic.
    // If ANY statement fails, the entire transaction rolls back.
    //
    // Critical: This ensures we never have PARTIAL migrations.
    // Either the migration fully applies or it doesn't apply at all.

    await dbRun(db, "BEGIN TRANSACTION");

    try {
      // Execute the migration SQL
      // Note: Using db.exec() instead of db.run() because migrations
      // contain multiple statements (CREATE TABLE, CREATE INDEX, etc.)
      await dbExec(db, sql);

      // Record that this migration was successfully applied
      // This happens INSIDE the transaction, so if the migration SQL
      // succeeded but we crash before recording it, the rollback will
      // also undo the schema_migrations insert.
      await dbRun(db, "INSERT INTO schema_migrations (version) VALUES (?)", [version]);

      // COMMIT - Make all changes permanent
      await dbRun(db, "COMMIT");

      logger.info(`  ✅ Successfully applied: ${file}`);
    } catch (err) {
      // ──────────────────────────────────────────────────────────────
      // ERROR HANDLING: Rollback and Fail Fast
      // ──────────────────────────────────────────────────────────────
      // If anything failed, rollback the entire transaction.
      // This returns the database to the state it was in before BEGIN.

      await dbRun(db, "ROLLBACK");

      const errorMessage = err instanceof Error ? err.message : String(err);

      // Re-throw with context
      // Why throw? We want the application startup to FAIL if migrations fail.
      // Fail-fast principle: Better to crash at startup than serve requests
      // with a broken/incomplete schema.
      throw new Error(
        `❌ Migration failed: ${file}\n` +
          `Error: ${errorMessage}\n` +
          `Database rolled back to previous state.`
      );
    }
  }

  logger.info(`✅ All ${pendingMigrations.length} migration(s) applied successfully`);
}
