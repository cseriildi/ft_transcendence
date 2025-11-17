/**
 * Password Validation Utilities - Environment-Aware
 *
 * @concept Password Strength & Security
 *
 * Why Length > Complexity:
 * - **Entropy Math**: 26^12 (lowercase, 12 chars) > 72^6 (all types, 6 chars)
 * - **User Behavior**: Complex rules → predictable patterns (Password1!)
 * - **NIST Guidelines**: Recommend length over character type requirements
 *
 * Attack Vectors:
 * - **Brute Force**: Try all combinations (stopped by length + rate limiting)
 * - **Dictionary**: Try common passwords (stopped by minimum length)
 * - **Credential Stuffing**: Reuse leaked passwords (stopped by unique passwords)
 *
 * Environment Strategy:
 * - **Dev**: Min 1 char (no friction for testing)
 * - **Prod**: Min 10 chars + number (balance security/UX)
 *
 * Real-World Impact:
 * - 8 chars: ~6 hours to crack with GPU
 * - 10 chars: ~5 years to crack
 * - 12 chars: ~200,000 years to crack
 *
 * Interview Angle:
 * "Why not require uppercase, lowercase, number, symbol?"
 * → Research shows length matters most. "Password1!" is predictable.
 *     "correcthorsebatterystaple" is stronger despite no special chars.
 */

import { errors } from "./errorUtils.ts";
import { config } from "../config.ts";

const isProduction = config.server.env === "production";

interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate password according to environment rules
 *
 * Dev: Minimum 1 character (any password allowed)
 * Prod: Minimum 10 characters + at least 1 number
 */
export function validatePassword(password: string): PasswordValidationResult {
  // Dev environment - allow anything (min 1 char)
  if (!isProduction) {
    if (!password || password.length < 1) {
      return {
        valid: false,
        error: "Password must be at least 1 character",
      };
    }
    return { valid: true };
  }

  // Production environment - enforce security rules
  if (!password || password.length < 10) {
    return {
      valid: false,
      error: "Password must be at least 10 characters long",
    };
  }

  // Require at least one number
  if (!/\d/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one number",
    };
  }

  return { valid: true };
}

/**
 * Assert password is valid, throw error if not
 * Use this in controller logic for clean error handling
 */
export function assertPasswordValid(password: string, context?: Record<string, unknown>): void {
  const result = validatePassword(password);
  if (!result.valid) {
    throw errors.validation(result.error!, {
      ...context,
      passwordLength: password.length,
      isProduction,
    });
  }
}

/**
 * Get password requirements as user-friendly string
 * Useful for API documentation and error messages
 */
export function getPasswordRequirements(): string {
  if (!isProduction) {
    return "At least 1 character (dev environment)";
  }
  return "At least 10 characters with at least 1 number";
}
