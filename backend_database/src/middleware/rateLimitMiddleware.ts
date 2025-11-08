/**
 * Rate Limiting Middleware - Tiered Approach
 *
 * @concept Tiered Rate Limiting by Risk Profile
 *
 * Why Different Tiers:
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
 *
 * Interview Angle:
 * "How do you scale rate limiting across multiple servers?"
 * → Redis with atomic INCR/EXPIRE, shared state, sub-millisecond latency
 * "Why per-user for authenticated vs per-IP for public?"
 * → User can't spoof userId (JWT verified), IP can be shared (NAT, VPN)
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
 *
 * Why 100/min:
 * - Average user makes ~10-20 API calls per page load
 * - SPA with polling might make 1 req/sec = 60/min
 * - 100/min allows burst + polling without hitting limit
 * - Still protects against abuse (6000 req/hour from single user)
 */
export async function authenticatedRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
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

/**
 * Optional: Rate limit for public endpoints (already have global 20/sec)
 *
 * This could be used for more granular public endpoint limits
 * Example: Public search endpoint might be 10/min per IP
 */
export async function publicRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip in test environment
  if (config.server.env === "test") {
    return;
  }

  // Per-IP rate limiting for public endpoints
  const clientIp = request.ip;
  const key = `public:${clientIp}`;

  // This is in addition to global 20/sec limit
  // Use for specific public endpoints that need stricter limits
  checkRateLimit(key, 100, 60);
}
