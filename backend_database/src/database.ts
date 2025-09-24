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
  const initDb = async () => {
    const run = (sql: string) =>
      new Promise<void>((resolve, reject) => db.run(sql, (err) => (err ? reject(err) : resolve())));
    db.serialize();
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner TEXT NOT NULL,
        loser TEXT NOT NULL,
        winner_score INTEGER NOT NULL,
        loser_score INTEGER NOT NULL,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (winner) REFERENCES users(username),
        FOREIGN KEY (loser) REFERENCES users(username)
      )`);
    fastify.log.info("Database schema initialized");
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
