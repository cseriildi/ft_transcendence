import sqlite3, { Database } from "sqlite3";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { config } from "./config.js";

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

  // Initialize database schema
  const initDb = () => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
          CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocker TEXT NOT NULL,
			      blocked_user TEXT NOT NULL,
            blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(blocker, blocked_user)
            )
            `,
          (err) => {
            if (err) {
              fastify.log.error("Error creating users table: %s", err.message);
              reject(err);
            } else {
              fastify.log.info("Database schema initialized");
              resolve(undefined);
            }
          }
        );
      });
    });
  };

  // Initialize the database
  try {
    await initDb();
  } catch (error) {
    fastify.log.error("Failed to initialize database: %s", String(error));
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

/**
 * Preload all bans from database into memory
 * Creates bidirectional bans so both blocker and blocked cannot message each other
 */
export async function preloadBanList(db: sqlite3.Database): Promise<Map<string, Set<string>>> {
  return new Promise((resolve, reject) => {
    db.all("SELECT blocker, blocked_user FROM blocks", [], (err: Error, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }

      const banMap = new Map<string, Set<string>>();

      if (rows) {
        rows.forEach((row: any) => {
          const blocker = row.blocker;
          const blocked = row.blocked_user;

          // Add blocker -> blocked
          if (!banMap.has(blocker)) {
            banMap.set(blocker, new Set());
          }
          banMap.get(blocker)!.add(blocked);

          // Add blocked -> blocker (bidirectional)
          if (!banMap.has(blocked)) {
            banMap.set(blocked, new Set());
          }
          banMap.get(blocked)!.add(blocker);
        });
      }

      resolve(banMap);
    });
  });
}

export default fp(dbConnector, { name: "dbConnector" });
