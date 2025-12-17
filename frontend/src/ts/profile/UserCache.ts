import { config } from "../config.js";
import { getAccessToken } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

export interface CachedUser {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
}

/**
 * Handles user data caching for profile operations
 */
export class UserCache {
  private cache: Map<number, CachedUser> = new Map();

  public has(userId: number): boolean {
    return this.cache.has(userId);
  }

  public get(userId: number): CachedUser | undefined {
    return this.cache.get(userId);
  }

  public set(userId: number, userData: CachedUser): void {
    this.cache.set(userId, userData);
  }

  public clear(): void {
    this.cache.clear();
  }

  public async getUserData(userId: number): Promise<CachedUser | null> {
    // Check cache first
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const responseData = await response.json();
        const userData: CachedUser = {
          id: userId,
          username: responseData.data?.username || `User ${userId}`,
          email: responseData.data?.email || "",
          avatar_url: responseData.data?.avatar_url,
          created_at: responseData.data?.created_at,
        };
        this.cache.set(userId, userData);
        return userData;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  public async getUserName(userId: number): Promise<string> {
    const userData = await this.getUserData(userId);
    return userData?.username || `User ${userId}`;
  }
}
