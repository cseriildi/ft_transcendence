import { config } from "../config.js";
import { UserCache, CachedUser } from "./UserCache.js";
import { i18n } from "../utils/i18n.js";

/**
 * Handles profile data fetching and display
 */
export class ProfileData {
  private userCache: UserCache;

  constructor(userCache: UserCache) {
    this.userCache = userCache;
  }

  public async loadUserProfile(userId: string | number): Promise<void> {
    if (!userId) {
      console.error("No valid user ID found for profile fetch.");
      this.resetProfileElements();
      return;
    }

    const numericUserId = Number(userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      console.error("Invalid user ID provided:", userId);
      this.resetProfileElements();
      return;
    }

    try {
      const userData = await this.userCache.getUserData(numericUserId);
      if (userData) {
        this.updateProfileElements(userData);
      } else {
        console.error("Failed to fetch user data for user:", userId);
        this.resetProfileElements();
      }
    } catch (error) {
      console.error("Error fetching user data", error);
      this.resetProfileElements();
    }
  }

  private updateProfileElements(userData: CachedUser): void {
    const userName = document.getElementById("user-name");
    const userEmail = document.getElementById("user-email");
    const userAvatar = document.getElementById("user-avatar") as HTMLImageElement;

    if (userName) userName.textContent = userData.username;
    if (userEmail) userEmail.textContent = userData.email;
    if (userAvatar && userData.avatar_url) {
      userAvatar.src = `${config.apiUrl}${userData.avatar_url}`;
    }
  }

  private resetProfileElements(): void {
    const userName = document.getElementById("user-name");
    const userEmail = document.getElementById("user-email");
    const userAvatar = document.getElementById("user-avatar") as HTMLImageElement;

    if (userName) userName.textContent = i18n.t("profile.unknown");
    if (userEmail) userEmail.textContent = "";
    if (userAvatar) userAvatar.src = "";
  }
}
