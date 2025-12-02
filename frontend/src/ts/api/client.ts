/**
 * Type-safe API client for browser usage
 * Types are generated from the backend's OpenAPI spec
 *
 * This is a lightweight browser-compatible client that doesn't require bundling.
 */

import type { paths } from "./schema.js";
import { config } from "../config.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions<TBody = unknown> {
  body?: TBody;
  params?: Record<string, string | number>;
  headers?: Record<string, string>;
}

interface ApiResponse<TData, TError = unknown> {
  data: TData | undefined;
  error: TError | undefined;
  response: Response;
}

/**
 * Type-safe API client
 * Provides methods that match the OpenAPI paths for type checking
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<TData, TError = unknown>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions
  ): Promise<ApiResponse<TData, TError>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    // Add auth token if available
    const token = SecureTokenManager.getInstance().getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: "include",
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    let response = await fetch(url, fetchOptions);

    // Handle 401 - try to refresh token
    if (response.status === 401) {
      const tokenManager = SecureTokenManager.getInstance();
      try {
        await tokenManager.refreshAccessToken();
        const newToken = tokenManager.getAccessToken();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
          response = await fetch(url, { ...fetchOptions, headers });
        }
      } catch {
        tokenManager.handleTokenExpiry();
      }
    }

    let data: TData | undefined;
    let error: TError | undefined;

    try {
      const json = await response.json();
      if (response.ok) {
        data = json as TData;
      } else {
        error = json as TError;
      }
    } catch {
      // Response may not be JSON
    }

    return { data, error, response };
  }

  // Type-safe method wrappers
  async GET<P extends keyof paths>(
    path: P,
    options?: RequestOptions
  ): Promise<ApiResponse<
    paths[P] extends { get: { responses: { 200: { content: { "application/json": infer R } } } } } ? R : unknown
  >> {
    return this.request("GET", path as string, options);
  }

  async POST<P extends keyof paths>(
    path: P,
    options?: RequestOptions<
      paths[P] extends { post: { requestBody: { content: { "application/json": infer B } } } } ? B : never
    >
  ): Promise<ApiResponse<
    paths[P] extends { post: { responses: { 200: { content: { "application/json": infer R } } } } } ? R :
    paths[P] extends { post: { responses: { 201: { content: { "application/json": infer R } } } } } ? R : unknown
  >> {
    return this.request("POST", path as string, options);
  }

  async PATCH<P extends keyof paths>(
    path: P,
    options?: RequestOptions<
      paths[P] extends { patch: { requestBody: { content: { "application/json": infer B } } } } ? B : never
    >
  ): Promise<ApiResponse<
    paths[P] extends { patch: { responses: { 200: { content: { "application/json": infer R } } } } } ? R : unknown
  >> {
    return this.request("PATCH", path as string, options);
  }

  async DELETE<P extends keyof paths>(
    path: P,
    options?: RequestOptions
  ): Promise<ApiResponse<
    paths[P] extends { delete: { responses: { 200: { content: { "application/json": infer R } } } } } ? R : unknown
  >> {
    return this.request("DELETE", path as string, options);
  }
}

export const api = new ApiClient(config.apiUrl);

// Re-export types for convenience
export type { paths } from "./schema.js";
