import { FastifyRequest, FastifyReply } from "fastify";
import { errors } from "../utils/errorUtils.ts";
import { config } from "../config.ts";
import crypto from "node:crypto";

/**
 * Middleware to verify requests from internal services (e.g., gamelogic)
 */
export async function requireServiceAuth(request: FastifyRequest, _reply: FastifyReply) {
  const serviceSecret = config.serviceAuth.secret;

  const serviceToken = request.headers["x-service-token"];

  if (!serviceToken || typeof serviceToken !== "string") {
    throw errors.unauthorized("Service token required", {
      middleware: "requireServiceAuth",
      url: request.url,
    });
  }

  // Ensure both buffers are the same length for timing-safe comparison
  if (serviceToken.length !== serviceSecret.length) {
    throw errors.unauthorized("Invalid service token", {
      middleware: "requireServiceAuth",
      url: request.url,
    });
  }

  // Constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(Buffer.from(serviceToken), Buffer.from(serviceSecret));

  if (!isValid) {
    throw errors.unauthorized("Invalid service token", {
      middleware: "requireServiceAuth",
      url: request.url,
    });
  }

  request.isServiceRequest = true;
}
