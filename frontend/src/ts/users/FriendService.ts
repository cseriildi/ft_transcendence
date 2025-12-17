import { config } from "../config.js";
import { getAccessToken } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

export interface Friend {
  user_id: number;
  status: string;
  is_inviter: boolean;
}

export interface FriendsResponse {
  data?: {
    friends?: Friend[];
  };
}

export class FriendService {
  async getFriendsStatus(): Promise<FriendsResponse | undefined> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        return await response.json();
      } else {
        return undefined;
      }
    } catch (error) {
      return undefined;
    }
  }

  async addFriend(userId: number): Promise<boolean> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/${userId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async deleteFriend(userId: number): Promise<boolean> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async acceptFriend(userId: number): Promise<boolean> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/${userId}/accept`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async declineFriend(userId: number): Promise<boolean> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/${userId}/decline`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
}
