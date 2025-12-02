/**
 * API module exports
 * Central export point for all API functions and types
 */

// Core client
export { api } from "./client.js";

// Auth API
export {
  login,
  login2FA,
  register,
  refreshToken,
  logout,
  requires2FA,
  type AuthResult,
  type LoginSuccessData,
  type Login2FARequiredData,
  type LoginData,
  type LoginRequest,
  type Login2FARequest,
  type RegisterRequest,
} from "./auth.js";

// Re-export schema types
export type { paths } from "./schema.js";
