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
        console.error("Failed to fetch friends status", await response.json());
        return undefined;
      }
    } catch (error) {
      console.error("Error fetching friends status", error);
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
        console.error("Failed to add friend", await response.json());
        return false;
      }
    } catch (error) {
      console.error("Error adding friend", error);
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
        console.error("Failed to delete friend", await response.json());
        return false;
      }
    } catch (error) {
      console.error("Error deleting friend", error);
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
        console.error("Failed to accept request", await response.json());
        return false;
      }
    } catch (error) {
      console.error("Error accepting request", error);
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
        console.error("Failed to decline request", await response.json());
        return false;
      }
    } catch (error) {
      console.error("Error declining request", error);
      return false;
    }
  }
}
