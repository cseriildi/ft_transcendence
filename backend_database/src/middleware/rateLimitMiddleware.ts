/**
 * 
 *  two layer rate limiting middleware in addition to global rate limiting
 *  provided by @fastify/rate-limit
 * 
 *  Different limits for different endpoint categories:
 *  Authentication (5/5min)**: High-risk, brute force target
 *  2FA (5/15min + lockout)**: Critical security, 1M combinations
 *  Authenticated API (100/min)**: Normal usage, per-user tracking
 *  Public/Unauthenticated (20/sec)**: Global DoS protection
 *
 * Architecture:
 * - Middleware checks user auth status (request.user from JWT)
 * - Applies appropriate rate limit based on endpoint + auth status
 * - Per-user for authenticated, per-IP for public
 * - Specific endpoints (login, 2FA) handle their own limits in controllers
 *
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { checkRateLimit } from "../utils/rateLimitUtils.ts";
import { config } from "../config.ts";

/**
 * Applies to: /api/* routes (users, matches, friends)
 * Does NOT apply to other routes (auth, 2fa, health)
 */
export async function authenticatedRateLimit(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Skip in test environment (unless testing rate limits explicitly)
  if (config.server.env === "test") {
    return;
  }
  
  // Only apply to authenticated users
  if (!request.user) {
    return;
  }

  // Per-user rate limiting
  const userId = request.user.id;
  const key = `api:user:${userId}`;

  // 100 requests per minute per user
  checkRateLimit(key, 100, 60);
}
