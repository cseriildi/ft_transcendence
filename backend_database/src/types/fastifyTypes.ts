import { Database } from "sqlite3";
import { AccessTokenPayload } from "../services/authService/authTypes.ts";

// Extend Fastify's types globally
declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
  interface FastifyRequest {
    // User is populated from access token (which has no JTI)
    user?: AccessTokenPayload & { id: number };
  }
}
