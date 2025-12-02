/**
 * Type-safe API client using openapi-fetch
 * Types are generated from the backend's OpenAPI spec
 *
 * Usage:
 *   import { api } from './api/client.js';
 *   const { data, error } = await api.POST('/auth/login', { body: { email, password } });
 */

import createClient from "openapi-fetch";
import type { paths } from "./schema.js";
import { config } from "../config.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";

// Create the base API client
const baseClient = createClient<paths>({
  baseUrl: config.apiUrl,
  credentials: "include", // Include cookies for refresh token
});

/**
 * Middleware to add auth header and handle token refresh
 */
baseClient.use({
  async onRequest({ request }) {
    const token = SecureTokenManager.getInstance().getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },

  async onResponse({ response, request }) {
    // If 401, try to refresh token and retry
    if (response.status === 401) {
      const tokenManager = SecureTokenManager.getInstance();
      try {
        await tokenManager.refreshAccessToken();
        const newToken = tokenManager.getAccessToken();
        if (newToken) {
          // Clone and retry request with new token
          const newRequest = request.clone();
          newRequest.headers.set("Authorization", `Bearer ${newToken}`);
          return fetch(newRequest);
        }
      } catch {
        tokenManager.handleTokenExpiry();
      }
    }
    return response;
  },
});

export const api = baseClient;

// Re-export types for convenience
export type { paths } from "./schema.js";
