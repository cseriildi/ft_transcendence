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

  //Setup database configuration and run migrations
  const setupDatabase = async () => {
    // Helper function for promisified db.run()
    const run = (sql: string) =>
      new Promise<void>((resolve, reject) => db.run(sql, (err) => (err ? reject(err) : resolve())));
    await run("PRAGMA foreign_keys = ON");
    fastify.log.info("Foreign key constraints enabled");

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
