import { getAccessToken } from "../utils/utils.js";
import { config } from "../config.js";

export interface CachedUser {
  id: number;
  username: string;
}

/**
 * Manages user caching to avoid repeated API calls
 */
export class UserCache {
  private cache: Map<string, string> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  public async loadAllUsers(): Promise<void> {
    if (this.cache.size > 0 && !this.isCacheExpired()) {
      return;
    }

    if (this.isCacheExpired()) {
      this.clear();
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/users`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const users = userData.data;

        users.forEach((user: CachedUser) => {
          this.cache.set(user.id.toString(), user.username);
        });

        this.cacheTimestamp = Date.now();
      }
    } catch (error) {
      // Silently fail - will use userId as fallback
    }
  }

  public async getUsernameById(userId: string): Promise<string> {
    await this.loadAllUsers();

    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    return userId;
  }

  private isCacheExpired(): boolean {
    if (this.cacheTimestamp === 0) return true;
    return Date.now() - this.cacheTimestamp > this.CACHE_EXPIRY_MS;
  }

  public clear(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }
}
