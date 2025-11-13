import sqlite3 from "sqlite3";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { config } from "../config.ts";
import { runMigrations } from "../db_migrator/migrator.ts";

interface DatabaseOptions {
  path?: string;
}

async function dbConnector(fastify: FastifyInstance, options: DatabaseOptions) {
  const dbPath = options.path || config.database.path;

  // Create database connection with Promise wrapper
  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        fastify.log.error("Could not connect to database: %s", err.message);
        reject(err);
      } else {
        fastify.log.info(`Connected to database at ${dbPath}`);
        resolve(database);
      }
    });
  });

  /**
   * Setup database configuration and run migrations
   *
   * Why two separate operations?
   * ────────────────────────────────────────────────────────────────
   * 1. Enable foreign keys (SQLite-specific requirement)
   * 2. Run schema migrations
   *
   * Critical SQLite Gotcha: Foreign Keys
   * ────────────────────────────────────────────────────────────────
   * SQLite DISABLES foreign key constraints by default for backwards
   * compatibility. You must enable them on EVERY connection.
   *
   * This is NOT persisted to the database file, it's a per-connection
   * setting. That's why we do it here, not in a migration.
   *
   * What happens without PRAGMA foreign_keys = ON?
   * → You can delete a user and their refresh_tokens remain (orphaned data)
   * → You can insert refresh_token with user_id=999 that doesn't exist
   * → Foreign key constraints are completely ignored
   *
   * Real-world impact: Data integrity violations that corrupt your database.
   */
  const setupDatabase = async () => {
    // Helper function for promisified db.run()
    const run = (sql: string) =>
      new Promise<void>((resolve, reject) => db.run(sql, (err) => (err ? reject(err) : resolve())));

    // Enable foreign key constraints (must be done on every connection)
    await run("PRAGMA foreign_keys = ON");
    fastify.log.info("Foreign key constraints enabled");

    // Run migration system (handles all schema setup)
    await runMigrations(db, fastify.log);
  };

  // Initialize the database
  try {
    await setupDatabase();
  } catch (error) {
    fastify.log.error("Failed to setup database: %s", String(error));
    throw error;
  }

  fastify.decorate("db", db);
  fastify.addHook("onClose", async (instance) => {
    return new Promise<void>((resolve, reject) => {
      instance.db.close((err: Error | null) => {
        if (err) {
          instance.log.error("Error closing database: %s", err.message);
          reject(err); // Properly propagate error
        } else {
          instance.log.info("Database connection closed");
          resolve();
        }
      });
    });
  });
}

export default fp(dbConnector, { name: "dbConnector" });
