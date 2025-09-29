import { Database } from "sqlite3";

// Extend Fastify's types globally
declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}
