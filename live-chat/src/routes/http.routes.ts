import type { FastifyInstance } from "fastify";
import { banList, userConnections } from "../services/state.js";

/**
 * Register HTTP routes
 */
export async function registerHttpRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get("/health", async (request, reply) => {
    return { status: "ok" };
  });

  // Readiness check endpoint (includes database check)
  fastify.get("/ready", async (request, reply) => {
    try {
      const db = await request.server.db;
      return new Promise((resolve, reject) => {
        db.get("SELECT 1", (err) => {
          if (err) {
            reject(err);
          } else {
            resolve({ database: "ready" });
          }
        });
      });
    } catch (err) {
      return Promise.reject(err);
    }
  });

  // Block user endpoint
  fastify.post("/lobby/block", async (request, reply) => {
    const { blocker, blocked } = request.body as {
      blocker: string;
      blocked: string;
    };

    // Validation
    if (!blocker || !blocked) {
      return reply.status(400).send({ error: "Missing blocker or blocked userId" });
    }

    if (blocker === blocked) {
      return reply.status(400).send({ error: "Cannot block yourself" });
    }

    // Check if blocker is connected (has active connections)
    if (!userConnections.has(blocker)) {
      return reply.status(401).send({ error: "Blocker must be connected to block users" });
    }

    // Check if already blocked
    if (banList.has(blocker) && banList.get(blocker)!.has(blocked)) {
      return reply.status(400).send({ error: "User is already blocked" });
    }

    // Add to in-memory ban list
    if (!banList.has(blocker)) {
      banList.set(blocker, new Set());
    }
    banList.get(blocker)!.add(blocked);

    // Persist to database
    try {
      const db = await request.server.db;
      return new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)",
          [blocker, blocked],
          (err) => {
            if (err) {
              fastify.log.error(
                "Error blocking userId %s for userId %s: %s",
                blocked,
                blocker,
                err.message
              );
              reject(err);
            }
            resolve({ success: true });
          }
        );
      });
    } catch (err) {
      fastify.log.error("Database connection error: %s", String(err));
      return reply.status(500).send({ error: "Database connection error" });
    }
  });
}
