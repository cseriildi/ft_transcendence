import sqlite3, { Database } from "sqlite3";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { config } from "./config.ts";

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
        // Create tables here
        db.run(
          `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            online_status INTEGER DEFAULT 0,
            token TEXT UNIQUE NOT NULL,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
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

		db.run(
          `
          CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocker TEXT NOT NULL,
			      blocked_user TEXT NOT NULL,
            blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			      FOREIGN KEY (blocker) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY (blocked_user) REFERENCES users(username) ON DELETE CASCADE
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

export default fp(dbConnector, { name: "dbConnector" });