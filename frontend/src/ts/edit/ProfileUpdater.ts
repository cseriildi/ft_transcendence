import { config } from "../config.js";
import { getUserId, getAccessToken } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

export class ProfileUpdater {
  async updateEmail(email: string): Promise<Response> {
    const userId = getUserId();
    if (!userId) {
      throw new Error("User ID not found");
    }

    return fetchWithRefresh(`${config.apiUrl}/api/users/${userId}/email`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      credentials: "include",
    });
  }

  async updateUsername(username: string): Promise<Response> {
    const userId = getUserId();
    if (!userId) {
      throw new Error("User ID not found");
    }

    return fetchWithRefresh(`${config.apiUrl}/api/users/${userId}/username`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
      credentials: "include",
    });
  }

  async updateAvatar(file: File): Promise<Response> {
    const formData = new FormData();
    formData.append("avatar", file);

    return fetchWithRefresh(`${config.apiUrl}/api/users/avatar`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  }

  async getUserData(): Promise<any> {
    const userId = getUserId();
    if (!userId) {
      throw new Error("User ID not found");
    }

    const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${userId}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user data");
    }

    const userData = await response.json();
    return userData.data;
  }
}
