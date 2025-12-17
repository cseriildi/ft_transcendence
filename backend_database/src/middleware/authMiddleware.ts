import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../utils/authUtils.ts";
import { errors } from "../utils/errorUtils.ts";

/**
 * Middleware to verify JWT access token from Authorization header
 * Attaches decoded user info to request.user
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw errors.unauthorized("Access token required", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 7),
      middleware: "requireAuth",
      url: request.url,
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const payload = await verifyAccessToken(token);

    // Attach user info to request for use in handlers
    request.user = {
      id: parseInt(payload.sub!),
    };
  } catch (error) {
    // verifyAccessToken already throws errors.unauthorized
    throw error;
  }
}
