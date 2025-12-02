/**
 * Type-safe Auth API functions
 * Uses the generated OpenAPI types for request/response validation
 */

import { api } from "./client.js";
import type { paths } from "./schema.js";

// Extract types from the generated paths
export type LoginRequest = paths["/api/auth/login"]["post"]["requestBody"]["content"]["application/json"];
export type Login2FARequest = paths["/api/auth/login/2fa"]["post"]["requestBody"]["content"]["application/json"];
export type RegisterRequest = paths["/api/auth/register"]["post"]["requestBody"]["content"]["application/json"];

// Response type helpers
export type AuthResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; message?: string };

export interface LoginSuccessData {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  tokens: {
    accessToken: string;
  };
}

export interface Login2FARequiredData {
  requires2fa: true;
  tempToken: string;
}

export type LoginData = LoginSuccessData | Login2FARequiredData;

/**
 * Login with email and password
 * Returns either user data with tokens, or 2FA required response
 */
export async function login(
  credentials: LoginRequest
): Promise<AuthResult<LoginData>> {
  const { data, error, response } = await api.POST("/api/auth/login", {
    body: credentials,
  });

  if (error || !response.ok) {
    return {
      success: false,
      error: (error as any)?.message || "Login failed",
      message: (error as any)?.message,
    };
  }

  if (!data?.data) {
    return { success: false, error: "Invalid response from server" };
  }

  // Check if 2FA is required
  if (data.data.requires2fa && data.data.tempToken) {
    return {
      success: true,
      data: {
        requires2fa: true as const,
        tempToken: data.data.tempToken,
      },
      message: data.message,
    };
  }

  // Normal login success
  if (data.data.id && data.data.tokens?.accessToken) {
    return {
      success: true,
      data: {
        id: data.data.id,
        username: data.data.username!,
        email: data.data.email!,
        avatar_url: data.data.avatar_url,
        created_at: data.data.created_at!,
        tokens: {
          accessToken: data.data.tokens.accessToken,
        },
      },
      message: data.message,
    };
  }

  return { success: false, error: "Invalid response format" };
}

/**
 * Type guard to check if login result requires 2FA
 */
export function requires2FA(data: LoginData): data is Login2FARequiredData {
  return "requires2fa" in data && data.requires2fa === true;
}

/**
 * Complete 2FA verification
 */
export async function login2FA(
  credentials: Login2FARequest
): Promise<AuthResult<LoginSuccessData>> {
  const { data, error, response } = await api.POST("/api/auth/login/2fa", {
    body: credentials,
  });

  if (error || !response.ok) {
    return {
      success: false,
      error: (error as any)?.message || "2FA verification failed",
      message: (error as any)?.message,
    };
  }

  if (!data?.data?.id || !data?.data?.tokens?.accessToken) {
    return { success: false, error: "Invalid response from server" };
  }

  return {
    success: true,
    data: {
      id: data.data.id,
      username: data.data.username!,
      email: data.data.email!,
      avatar_url: data.data.avatar_url,
      created_at: data.data.created_at!,
      tokens: {
        accessToken: data.data.tokens.accessToken,
      },
    },
    message: data.message,
  };
}

/**
 * Register a new user
 */
export async function register(
  userData: RegisterRequest
): Promise<AuthResult<LoginSuccessData>> {
  const { data, error, response } = await api.POST("/api/auth/register", {
    body: userData,
  });

  if (error || !response.ok) {
    return {
      success: false,
      error: (error as any)?.message || "Registration failed",
      message: (error as any)?.message,
    };
  }

  if (!data?.data?.id || !data?.data?.tokens?.accessToken) {
    return { success: false, error: "Invalid response from server" };
  }

  return {
    success: true,
    data: {
      id: data.data.id,
      username: data.data.username!,
      email: data.data.email!,
      avatar_url: data.data.avatar_url,
      created_at: data.data.created_at!,
      tokens: {
        accessToken: data.data.tokens.accessToken,
      },
    },
    message: data.message,
  };
}

/**
 * Refresh access token
 */
export async function refreshToken(): Promise<AuthResult<LoginSuccessData>> {
  const { data, error, response } = await api.POST("/api/auth/refresh", {});

  if (error || !response.ok) {
    return {
      success: false,
      error: (error as any)?.message || "Token refresh failed",
      message: (error as any)?.message,
    };
  }

  if (!data?.data?.id || !data?.data?.tokens?.accessToken) {
    return { success: false, error: "Invalid response from server" };
  }

  return {
    success: true,
    data: {
      id: data.data.id,
      username: data.data.username!,
      email: data.data.email!,
      avatar_url: data.data.avatar_url,
      created_at: data.data.created_at!,
      tokens: {
        accessToken: data.data.tokens.accessToken,
      },
    },
    message: data.message,
  };
}

/**
 * Logout user
 */
export async function logout(): Promise<AuthResult<void>> {
  const { error, response } = await api.POST("/api/auth/logout", {});

  if (error || !response.ok) {
    return {
      success: false,
      error: (error as any)?.message || "Logout failed",
      message: (error as any)?.message,
    };
  }

  return { success: true, data: undefined };
}
