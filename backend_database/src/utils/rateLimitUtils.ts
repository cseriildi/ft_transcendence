
import { errors } from "./errorUtils.ts";
import { config } from "../config.ts";

// Skip rate limiting in test environment (except explicit rate limit tests)
const isTestEnv = config.server.env === "test" || process.env.NODE_ENV === "test";

interface RateLimitEntry {
  attempts: number;
  resetAt: Date;
  lockedUntil?: Date; // For lockout enforcement
}

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

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  lockoutMinutes?: number
): void {
  if (isTestEnv) {
    return;
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

  if (!entry || entry.resetAt < now) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);
    rateLimitStore.set(key, { attempts: 1, resetAt });
    return; // Allowed - first attempt or window expired
  }

  entry.attempts++;

  if (entry.attempts > maxAttempts) {
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
  // Allowed - under the limit
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

export function getRateLimitStatus(key: string): { attempts: number; resetAt: Date } | null {
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt < new Date()) {
    return null;
  }
  return { attempts: entry.attempts, resetAt: entry.resetAt };
}

export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
