import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { randomBytes } from "crypto";

/**
 * Request ID Middleware - Correlation IDs for distributed tracing
 *
 * @concept Observability & Debugging
 * Request IDs (correlation IDs) let you track a single request across multiple operations.
 *
 * Why this matters:
 * - Logs from one request are scattered across time and services
 * - Request ID lets you grep/filter all logs for one specific request
 * - Essential for debugging production issues: "Show me everything that happened for request abc123"
 *
 * How it works:
 * 1. Generate unique ID for each request (or use client-provided ID)
 * 2. Attach to request object (request.id)
 * 3. Pino logger automatically includes it in all logs via serializer
 * 4. Return in response header (X-Request-ID) for client debugging
 *
 * Interview angle:
 * "How do you debug issues in distributed systems?"
 * → "Request IDs for correlation. Every request gets a unique ID that flows through all logs,
 *    making it easy to reconstruct what happened even across microservices."
 */

/**
 * Generates a unique request ID
 * Format: req-{timestamp}-{random} for easy chronological sorting
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36); // Base36 timestamp (shorter)
  const random = randomBytes(4).toString("hex"); // 8 char random
  return `req-${timestamp}-${random}`;
}

async function requestIdPlugin(fastify: FastifyInstance) {
  // Add request ID hook - runs for every request
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Use client-provided ID if present (for client-side tracing), otherwise generate
    const requestId = (request.headers["x-request-id"] as string) || generateRequestId();

    // Attach to request object (Fastify provides request.id by default, but we override it)
    request.id = requestId;

    // Add to response header so client can reference it
    reply.header("X-Request-ID", requestId);
  });

  // Configure Pino logger to include request ID in every log
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    // Create child logger with request ID context
    request.log = request.log.child({ reqId: request.id });
  });
}

export default fp(requestIdPlugin, {
  name: "request-id-plugin",
  fastify: "5.x",
});
