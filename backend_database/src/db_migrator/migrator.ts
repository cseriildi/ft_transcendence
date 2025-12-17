import { Database } from "sqlite3";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import type { FastifyBaseLogger } from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  version: string;
  applied_at: string;
}

function dbRun(db: Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function dbExec(db: Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function dbAll<T>(db: Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

export async function runMigrations(db: Database, logger: FastifyBaseLogger): Promise<void> {
  logger.info("🔄 Starting database migration check...");

  await dbRun(
    db,
    `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  );

  const appliedMigrations = await dbAll<Migration>(
    db,
    "SELECT version FROM schema_migrations ORDER BY version"
  );

  const appliedSet = new Set(appliedMigrations.map((m) => m.version));

  logger.info(`📋 Found ${appliedMigrations.length} previously applied migrations`);

  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // Chronological order via timestamp prefix

  const pendingMigrations = files.filter((file) => {
    const version = file.replace(".sql", "");
    return !appliedSet.has(version);
  });

  if (pendingMigrations.length === 0) {
    logger.info("✅ Database schema is up-to-date");
    return;
  }

  logger.info(`📦 Found ${pendingMigrations.length} pending migration(s)`);

  for (const file of pendingMigrations) {
    const version = file.replace(".sql", "");
    logger.info(`  ⏳ Applying migration: ${file}`);

    const sql = readFileSync(join(migrationsDir, file), "utf-8");

    await dbRun(db, "BEGIN TRANSACTION");

    try {
      // Note: Using db.exec() instead of db.run() because migrations
      await dbExec(db, sql);
      await dbRun(db, "INSERT INTO schema_migrations (version) VALUES (?)", [version]);
      // COMMIT - Make all changes permanent
      await dbRun(db, "COMMIT");
      logger.info(`  ✅ Successfully applied: ${file}`);
    } catch (err) {
      await dbRun(db, "ROLLBACK");

      const errorMessage = err instanceof Error ? err.message : String(err);
      // Fail-fast principle: Better to crash at startup than serve requests
      throw new Error(
        `❌ Migration failed: ${file}\n` +
          `Error: ${errorMessage}\n` +
          `Database rolled back to previous state.`
      );
    }
  }
  logger.info(`✅ All ${pendingMigrations.length} migration(s) applied successfully`);
}
