/**
 * Different Tiers:
 * - 2FA verification: 5 attempts/15min (critical - 6-digit = 1M combos)
 * - Login/Register: 5 attempts/5min per IP
 * - General API: 100 requests/min per user
 *
 * In-Memory vs Redis:
 * - In-Memory: Simple, works for single server (showcase appropriate)
 * - Redis: Persistent, scales across multiple servers (production upgrade)
 */

import { errors } from "./errorUtils.ts";
import { config } from "../config.ts";

// Skip rate limiting in test environment (except explicit rate limit tests)
const isTestEnv = config.server.env === "test" || process.env.NODE_ENV === "test";

interface RateLimitEntry {
  attempts: number;
  resetAt: Date;
  lockedUntil?: Date; // For lockout enforcement
}

// In-memory storage (TODO: Replace with Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leak
// .unref() allows graceful shutdown without blocking process exit
setInterval(
  () => {
    const now = new Date();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
).unref();

/**
 * Check if rate limit exceeded for a given key
 *
 * @param key - Unique identifier (e.g., "login:192.168.1.1" or "2fa:user:123")
 * @param maxAttempts - Maximum attempts allowed in window
 * @param windowSeconds - Time window in seconds
 * @param lockoutMinutes - Optional: Lock for this many minutes after exceeding limit
 * @returns Remaining attempts before limit
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  lockoutMinutes?: number
): { allowed: boolean; remaining: number; resetAt: Date } {
  // Bypass rate limiting in test environment
  if (isTestEnv) {
    return { allowed: true, remaining: maxAttempts, resetAt: new Date() };
  }

  const now = new Date();
  const entry = rateLimitStore.get(key);

  // Check if locked out
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    const secondsLeft = Math.ceil((entry.lockedUntil.getTime() - now.getTime()) / 1000);
    throw errors.forbidden(
      `Too many attempts. Account locked. Try again in ${Math.ceil(secondsLeft / 60)} minutes`,
      {
        key,
        lockedUntil: entry.lockedUntil.toISOString(),
        secondsRemaining: secondsLeft,
        rateLimitType: "lockout",
      }
    );
  }

  // No entry or expired - create new
  if (!entry || entry.resetAt < now) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);
    rateLimitStore.set(key, { attempts: 1, resetAt });
    return { allowed: true, remaining: maxAttempts - 1, resetAt };
  }

  // Increment attempts
  entry.attempts++;

  // Check if exceeded
  if (entry.attempts > maxAttempts) {
    // Apply lockout if specified
    if (lockoutMinutes) {
      entry.lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
      rateLimitStore.set(key, entry);

      throw errors.forbidden(`Too many attempts. Account locked for ${lockoutMinutes} minutes`, {
        key,
        attempts: entry.attempts,
        maxAttempts,
        lockedUntil: entry.lockedUntil.toISOString(),
        rateLimitType: "lockout",
      });
    }

    // No lockout - just deny this request
    const secondsLeft = Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000);
    throw errors.forbidden(`Rate limit exceeded. Try again in ${secondsLeft} seconds`, {
      key,
      attempts: entry.attempts,
      maxAttempts,
      resetAt: entry.resetAt.toISOString(),
      secondsRemaining: secondsLeft,
      rateLimitType: "rate_limit",
    });
  }

  rateLimitStore.set(key, entry);
  // comment this in if you want to attach retrun value to reply.header later on
  // return { allowed: true, remaining: maxAttempts - entry.attempts, resetAt: entry.resetAt };
}

/**
 * Manually reset rate limit for a key (useful after successful operation)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Get current attempt count for a key (for monitoring/logging)
 */
export function getRateLimitStatus(key: string): { attempts: number; resetAt: Date } | null {
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt < new Date()) {
    return null;
  }
  return { attempts: entry.attempts, resetAt: entry.resetAt };
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
