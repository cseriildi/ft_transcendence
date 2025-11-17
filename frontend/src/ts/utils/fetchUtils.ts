import { config } from "../config.js";

export async function fetchWithRefresh(url: string, options: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      const refreshResponse = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const accessToken = refreshData.data.tokens.accessToken;
        localStorage.setItem("accessToken", accessToken);

        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        };
        return fetch(url, options);
      } else {
        localStorage.clear();
        throw new Error("Failed to refresh token");
      }
    }

    return response;
  } catch (error) {
    console.error("Error in fetchWithRefresh:", error);
    throw error;
  }
}
