import { errors } from "./errorUtils.ts";
import { config } from "../config.ts";

const isProduction = config.server.env === "production";

interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!isProduction) {
    if (!password || password.length < 1) {
      return {
        valid: false,
        error: "Password must be at least 1 character",
      };
    }
    return { valid: true };
  }

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

export function getPasswordRequirements(): string {
  if (!isProduction) {
    return "At least 1 character (dev environment)";
  }
  return "At least 10 characters with at least 1 number";
}
