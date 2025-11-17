import { config } from "../config.js";
import { SecureTokenManager } from "./secureTokenManager.js";

export async function fetchWithRefresh(url: string, options: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      const tokenManager = SecureTokenManager.getInstance();

      try {
        await tokenManager.refreshAccessToken();

        const newToken = tokenManager.getAccessToken();
        if (newToken) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return fetch(url, options);
        } else {
          throw new Error("No token after refresh");
        }
      } catch (refreshError) {
        tokenManager.handleTokenExpiry();
        throw new Error("Failed to refresh token");
      }
    }

    return response;
  } catch (error) {
    console.error("Error in fetchWithRefresh:", error);
    throw error;
  }
}
