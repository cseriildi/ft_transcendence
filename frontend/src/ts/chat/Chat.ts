import { Router } from "../router/Router.js";
import { isUserAuthorized, getAccessToken } from "../utils/utils.js";
import { config } from "../config.js";
import { UserCache } from "./UserCache.js";
import { MessageRenderer } from "./MessageRenderer.js";
import { WebSocketHandler } from "./WebSocketHandler.js";
import { ChatActions } from "./ChatActions.js";
import { ChatUI } from "./ChatUI.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

/**
 * Main Chat class that orchestrates all chat-related functionality
 */

export class Chat {
  private router: Router;
  private userCache: UserCache;
  private messageRenderer: MessageRenderer;
  private webSocketHandler: WebSocketHandler;
  private chatActions: ChatActions;
  private chatUI: ChatUI;
  private chatBox: HTMLDivElement | null = null;
  private chatId: string | null = null;
  private partnerUsername: string | null = null;

  constructor(router: Router) {
    this.router = router;
    this.userCache = new UserCache();
    this.messageRenderer = new MessageRenderer();
    this.webSocketHandler = new WebSocketHandler(this.userCache, this.messageRenderer);
    this.chatActions = new ChatActions(this.messageRenderer);
    this.chatUI = new ChatUI(router);
  }

  public destroy(): void {
    console.log("Destroying chat instance...");
    this.cleanup();
  }

  private cleanup(): void {
    console.log("Cleaning up chat resources...");
    this.webSocketHandler.disconnect();
    this.userCache.clear();
  }

  public async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const chatBox = document.getElementById("chat-box") as HTMLDivElement;
    if (!chatBox) {
      console.error("Chat box element not found");
      return;
    }
    this.chatBox = chatBox;

    const urlParams = new URLSearchParams(window.location.search);
    this.chatId = urlParams.get("chatId");
    this.partnerUsername = urlParams.get("username");

    if (!this.chatId) {
      console.error("Chat ID is missing in the URL");
      return;
    }

    // Set up UI
    this.chatUI.setupUI(
      this.chatId,
      (message) => this.onSendMessage(message),
      () => this.onBack()
    );

    // Initialize chat partner info
    if (this.partnerUsername && this.chatId) {
      const isFriend = await this.checkIfFriend(this.chatId);
      await this.chatUI.setupChatPartnerInfo(
        this.partnerUsername,
        this.chatId,
        (userId) => this.onViewProfile(userId),
        (userId, username) => this.onBlockUser(userId, username),
        isFriend ? (userId, username) => this.onSendInvite(userId, username) : undefined
      );
    }

    // Connect WebSocket
    this.webSocketHandler.connect(this.chatId, this.chatBox, () => {
      console.log("Chat history loaded");
    });
  }

  /**
   * Check if the chat partner is a friend
   */
  private async checkIfFriend(chatId: string): Promise<boolean> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Failed to fetch friends status");
        return false;
      }

      const data = await response.json();
      const userIds = chatId.split("-").map((id) => parseInt(id));
      const currentUserId = Number(localStorage.getItem("userId"));
      const partnerId = userIds.find((id) => id !== currentUserId);

      if (!partnerId) {
        return false;
      }

      // Check if partner is in friends list with "accepted" status
      const friend = data.data.friends?.find(
        (f: { user_id: number; status: string }) =>
          f.user_id === partnerId && f.status === "accepted"
      );

      return !!friend;
    } catch (error) {
      console.error("Error checking friend status:", error);
      return false;
    }
  }

  /**
   * Handle sending a message
   */
  private async onSendMessage(message: string): Promise<void> {
    if (!this.chatId || !this.chatBox) {
      console.error("Chat ID or chat box not available");
      return;
    }

    await this.webSocketHandler.sendMessage(this.chatId, message, this.chatBox);
  }

  /**
   * Handle viewing profile
   */
  private onViewProfile(userId: number): void {
    this.cleanup();
    this.router.navigate(`/profile?userId=${userId}`);
  }

  /**
   * Handle blocking user
   */
  private async onBlockUser(userId: number, username: string): Promise<void> {
    await this.chatActions.blockUser(userId, username, () => {
      this.cleanup();
      this.router.navigate("/profile");
    });
  }

  /**
   * Handle sending game invite
   */
  private async onSendInvite(userId: number, username: string): Promise<void> {
    if (!this.chatId || !this.chatBox) {
      console.error("Chat ID or chat box not available");
      return;
    }

    await this.chatActions.sendGameInvite(userId, username, this.chatId, (message) => {
      this.webSocketHandler.sendMessage(this.chatId!, message, this.chatBox!).catch((err) => {
        console.error("Failed to send invite message:", err);
      });
    });
  }

  /**
   * Handle back button
   */
  private onBack(): void {
    this.cleanup();
    this.router.navigate("/profile");
  }
}

export default Chat;
