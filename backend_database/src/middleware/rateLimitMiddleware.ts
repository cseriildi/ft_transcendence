/**
 * - **Authentication (5/5min)**: High-risk, brute force target
 * - **2FA (5/15min + lockout)**: Critical security, 1M combinations
 * - **Authenticated API (100/min)**: Normal usage, per-user tracking
 * - **Public/Unauthenticated (20/sec)**: Global DoS protection
 *
 * Architecture:
 * - Middleware checks user auth status (request.user from JWT)
 * - Applies appropriate rate limit based on endpoint + auth status
 * - Per-user for authenticated, per-IP for public
 * - Specific endpoints (login, 2FA) handle their own limits in controllers
 *
 * Redis Swap-Out Strategy:
 * - rateLimitUtils.ts has in-memory Map
 * - To upgrade: Replace Map with Redis client
 * - Same function signatures: checkRateLimit(key, max, window)
 * - Zero changes to this middleware
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { checkRateLimit } from "../utils/rateLimitUtils.ts";
import { config } from "../config.ts";

/**
 * Rate limit middleware for authenticated API endpoints
 *
 * Applies to: /api/* routes (users, matches, friends)
 * Does NOT apply to: /auth/*, /oauth/* (handled by endpoint-specific limits)
 *
 * Limit: 100 requests per minute per authenticated user
 */
export async function authenticatedRateLimit(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Skip in test environment (unless testing rate limits explicitly)
  if (config.server.env === "test") {
    return;
  }

  // Only apply to authenticated users (request.user set by requireAuth middleware)
  if (!request.user) {
    // Public endpoints use global rate limit (20/sec from @fastify/rate-limit)
    return;
  }

  // Per-user rate limiting
  const userId = request.user.id;
  const key = `api:user:${userId}`;

  // 100 requests per minute per user
  checkRateLimit(key, 100, 60);
}
