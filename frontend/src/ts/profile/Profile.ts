import { Router } from "../router/Router.js";
import { getUserId, isUserAuthorized } from "../utils/utils.js";
import { UserCache } from "./UserCache.js";
import { ProfileStats } from "./ProfileStats.js";
import { GameHistory } from "./GameHistory.js";
import { FriendsList } from "./FriendsList.js";
import { ProfileData } from "./ProfileData.js";
import { i18n } from "../utils/i18n.js";

/**
 * Main Profile class that orchestrates all profile-related functionality
 */
export class Profile {
  private router: Router;
  private userCache: UserCache;
  private profileStats: ProfileStats;
  private gameHistory: GameHistory;
  private friendsList: FriendsList;
  private profileData: ProfileData;
  private languageChangeListener: (() => void) | null = null;
  private currentUserId: string | null = null;
  private isOwnProfile: boolean = false;

  constructor(router: Router) {
    this.router = router;
    this.userCache = new UserCache();
    this.profileStats = new ProfileStats();
    this.gameHistory = new GameHistory(this.userCache, this.profileStats);
    this.friendsList = new FriendsList(router);
    this.profileData = new ProfileData(this.userCache);
  }

  public destroy(): void {
    console.log("Destroying profile instance...");
    this.userCache.clear();
    if (this.languageChangeListener) {
      window.removeEventListener("languageChanged", this.languageChangeListener);
      this.languageChangeListener = null;
    }
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    // Clear cache to ensure fresh user data on each page load
    this.userCache.clear();

    // Get query parameters to check if we're viewing another user's profile
    const queryParams = this.router.getQueryParams();
    const viewingUserId = queryParams.userId;
    const currentUserId = getUserId();
    const isOwnProfile = !viewingUserId || viewingUserId === currentUserId?.toString();
    this.currentUserId = viewingUserId || currentUserId;
    this.isOwnProfile = isOwnProfile;

    // Set up UI elements
    this.setupUIElements(isOwnProfile, viewingUserId, currentUserId);
    this.setupLanguageListener();

    const targetUserId = isOwnProfile ? currentUserId : viewingUserId;

    if (!targetUserId) {
      console.error("No valid user ID found for profile fetch.");
      this.profileStats.reset();
      return;
    }

    // Load user profile data
    await this.profileData.loadUserProfile(targetUserId);

    // Load game history for the profile being viewed
    const gameHistoryContainer = document.getElementById("game-history");
    await this.gameHistory.loadGameHistory(targetUserId, gameHistoryContainer);

    // Only load friends list for own profile
    if (isOwnProfile) {
      const friendsListContainer = document.getElementById("friends-list");
      await this.friendsList.loadFriendsList(friendsListContainer);
    }
  }

  private setupUIElements(
    isOwnProfile: boolean,
    viewingUserId: string | undefined,
    currentUserId: string | null
  ): void {
    const editBtn = document.getElementById("edit-btn");
    const chatBtn = document.getElementById("chat-btn");
    const backBtn = document.getElementById("back-btn");
    const userName = document.getElementById("user-name");
    const findFriendsBtn = document.getElementById("find-friends-btn");
    const pageTitle = document.querySelector(".page-title");
    const friendsSection = document.getElementById("friends-card");

    // Update page title based on whose profile we're viewing
    if (pageTitle) {
      pageTitle.textContent = isOwnProfile ? i18n.t("profile.title") : i18n.t("profile.userProfile");
    }

    // Hide edit button and friends section when viewing another user's profile
    // Show chat button only when viewing someone else's profile
    if (!isOwnProfile) {
      if (editBtn) editBtn.style.display = "none";
      if (chatBtn) chatBtn.style.display = "inline-block";
      if (friendsSection) (friendsSection as HTMLElement).style.display = "none";
    } else {
      if (editBtn) editBtn.style.display = "inline-block";
      if (chatBtn) chatBtn.style.display = "none";
      if (friendsSection) (friendsSection as HTMLElement).style.display = "block";
    }

    // Set up event listeners
    findFriendsBtn?.addEventListener("click", () => this.router.navigate("/users"));
    backBtn?.addEventListener("click", () => this.router.navigate("/"));
    editBtn?.addEventListener("click", () => this.router.navigate("/edit"));

    // Chat button event listener - only for other users' profiles
    chatBtn?.addEventListener("click", () => {
      if (!isOwnProfile && viewingUserId && currentUserId) {
        const chatId = [Number(currentUserId), Number(viewingUserId)]
          .sort((a, b) => a - b)
          .join("-");
        const username = userName?.textContent || "Unknown";
        this.router.navigate(`/chat?chatId=${chatId}&username=${username}`);
      }
    });
  }

  private setupLanguageListener(): void {
    if (this.languageChangeListener) {
      window.removeEventListener("languageChanged", this.languageChangeListener);
    }

    this.languageChangeListener = async () => {
      console.log("Language changed, re-rendering profile page...");
      const pageTitle = document.querySelector(".page-title");
      if (pageTitle) {
        pageTitle.textContent = this.isOwnProfile ? i18n.t("profile.title") : i18n.t("profile.userProfile");
      }

      const gameHistoryContainer = document.getElementById("game-history");
      if (this.currentUserId) {
        await this.gameHistory.loadGameHistory(this.currentUserId, gameHistoryContainer);
      }

      if (this.isOwnProfile) {
        const friendsListContainer = document.getElementById("friends-list");
        await this.friendsList.loadFriendsList(friendsListContainer);
      }
    };

    window.addEventListener("languageChanged", this.languageChangeListener);
  }
}
