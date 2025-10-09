import { Database } from "sqlite3";
import { JwtPayload } from "../services/authService/authTypes.ts";


// Extend Fastify's types globally
declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
   interface FastifyRequest {
    user?: JwtPayload & { id: number }; // Add user property for auth middleware
  }
}
