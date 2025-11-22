import { Router } from "../router/Router.js";
import { getUserId, isUserAuthorized, getUsername, getAccessToken } from "../utils/utils.js";
import { config } from "../config.js";

export class Chat {
  private router: Router;
  private ws: WebSocket | null = null;
  private userCache: Map<string, string> = new Map(); // userId -> username cache
  private cacheTimestamp: number = 0; // Track when cache was last loaded
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes cache expiry

  constructor(router: Router) {
    this.router = router;
  }

  private clearUserCache(): void {
    console.log(`Clearing user cache (${this.userCache.size} entries)`);
    this.userCache.clear();
    this.cacheTimestamp = 0;
  }

  private isCacheExpired(): boolean {
    if (this.cacheTimestamp === 0) return true;
    return Date.now() - this.cacheTimestamp > this.CACHE_EXPIRY_MS;
  }

  private cleanup(): void {
    console.log("Cleaning up chat resources...");
    this.ws?.close();
    this.clearUserCache();
  }

  public destroy(): void {
    console.log("Destroying chat instance...");
    this.cleanup();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private createMessageElement(
    timestamp: string,
    username: string,
    message: string,
    isOwnMessage: boolean
  ): HTMLElement {
    const messageElement = document.createElement("div");

    // Escape all user-provided content
    const escapedUsername = this.escapeHtml(username);
    const escapedMessage = this.escapeHtml(message);

    const colorClass = isOwnMessage ? "text-neon-pink" : "text-neon-green";
    const alignmentClasses = isOwnMessage
      ? "mb-2 text-right ml-auto max-w-s"
      : "mb-2 text-left mr-auto max-w-s";

    const timestampSpan = document.createElement("span");
    timestampSpan.className = colorClass;
    timestampSpan.textContent = `[${timestamp}] ${escapedUsername}:`;

    const messageSpan = document.createElement("span");
    messageSpan.className = "text-white";
    messageSpan.textContent = escapedMessage;

    // Append elements safely
    messageElement.appendChild(timestampSpan);
    messageElement.appendChild(document.createElement("br"));
    messageElement.appendChild(messageSpan);

    messageElement.className = alignmentClasses;

    return messageElement;
  }

  private async loadAllUsers(): Promise<void> {
    // Check if cache is still valid
    if (this.userCache.size > 0 && !this.isCacheExpired()) {
      return;
    }

    // Clear expired cache
    if (this.isCacheExpired()) {
      this.clearUserCache();
    }

    try {
      console.log("Loading users cache...");
      const response = await fetch(`${config.apiUrl}/api/users`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const users = userData.data;

        users.forEach((user: { id: number; username: string }) => {
          this.userCache.set(user.id.toString(), user.username);
        });

        this.cacheTimestamp = Date.now();
        console.log(`Loaded ${users.length} users into cache`);
      } else {
        console.error("Failed to fetch users list");
      }
    } catch (error) {
      console.error("Error fetching users list:", error);
    }
  }

  private async getUsernameById(userId: string): Promise<string> {
    await this.loadAllUsers();

    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    return userId;
  }

  private async blockUser(partnerId: number): Promise<void> {
    const currentUserId = getUserId();
    if (!currentUserId) {
      console.error("Current user ID not found");
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/lobby/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
        body: JSON.stringify({
          blocker: currentUserId,
          blocked: partnerId.toString(),
        }),
      });

      if (response.ok) {
        alert("User blocked successfully. You will no longer receive messages from this user.");
        this.cleanup();
        this.router.navigate("/profile");
      } else {
        const error = await response.json();
        console.error("Failed to block user:", error);
        alert(error.error || "Failed to block user. Please try again.");
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      alert("An error occurred while blocking the user. Please try again.");
    }
  }

  private async setupChatPartnerInfo(partnerUsername: string, chatId: string): Promise<void> {
    const partnerUsernameElement = document.getElementById("partner-username");
    const partnerAvatarElement = document.getElementById("partner-avatar") as HTMLImageElement;
    const viewProfileBtn = document.getElementById("view-profile-btn");
    const blockUserBtn = document.getElementById("block-user-btn");

    if (partnerUsernameElement) {
      partnerUsernameElement.textContent = partnerUsername;
    }

    // Extract partner ID from chat ID
    const currentUserId = getUserId();
    if (!currentUserId) {
      console.error("Current user ID not found");
      return;
    }

    // Chat ID format is "userId1-userId2" where IDs are sorted
    const userIds = chatId.split("-").map((id) => parseInt(id));
    const partnerId = userIds.find((id) => id !== Number(currentUserId));

    if (!partnerId) {
      console.error("Partner ID could not be extracted from chat ID:", chatId);
      // Still set meaningful alt text
      if (partnerAvatarElement) {
        partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
      }
      return;
    }

    // Fetch specific partner's user data - much more efficient than fetching all users
    try {
      const response = await fetch(`${config.apiUrl}/api/users/${partnerId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const partner = data.data;

        // Set avatar and alt text
        if (partnerAvatarElement) {
          partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
          if (partner.avatar_url) {
            partnerAvatarElement.src = `${config.apiUrl}${partner.avatar_url}`;
          }
        }

        // Set up profile button click handler
        if (viewProfileBtn) {
          viewProfileBtn.addEventListener("click", () => {
            this.cleanup();
            this.router.navigate(`/profile?userId=${partnerId}`);
          });
        }

        // Set up block button click handler
        if (blockUserBtn) {
          blockUserBtn.addEventListener("click", async () => {
            const confirmed = confirm(
              `Are you sure you want to block ${partnerUsername}? You will no longer be able to send or receive messages from this user.`
            );
            if (confirmed) {
              await this.blockUser(partnerId);
            }
          });
        }
      } else {
        console.error("Failed to fetch partner info:", await response.json());
        // Still set meaningful alt text
        if (partnerAvatarElement) {
          partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
        }
      }
    } catch (error) {
      console.error("Error fetching partner info:", error);
      // Still set meaningful alt text
      if (partnerAvatarElement) {
        partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
      }
    }
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const chatForm = document.getElementById("chat-form") as HTMLFormElement;
    const chatInput = document.getElementById("chat-input") as HTMLInputElement;
    const chatBox = document.getElementById("chat-box") as HTMLDivElement;
    const backBtn = document.getElementById("back-btn");

    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get("chatId");
    const partnerUsername = urlParams.get("username");

    if (!chatId) {
      console.error("Chat ID is missing in the URL");
      return;
    }

    // Initialize chat partner info
    if (partnerUsername && chatId) {
      await this.setupChatPartnerInfo(partnerUsername, chatId);
    }

    this.connectWebSocket(chatBox);

    chatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      if (message && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "send_message", chatid: chatId, message }));

        const timestamp = new Date().toLocaleTimeString();
        const currentUsername = getUsername() || "Unknown";
        const messageElement = this.createMessageElement(timestamp, currentUsername, message, true);
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        chatInput.value = "";
      }
    });

    backBtn?.addEventListener("click", () => {
      this.cleanup();
      this.router.navigate("/profile");
    });
  }

  private connectWebSocket(chatBox: HTMLDivElement): void {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get("chatId");
    this.ws = new WebSocket(`${config.wsUrl}/chat?userId=${getUserId()}&username=${getUserId()}`);

    this.ws.onopen = () => {
      console.log("Connected to WebSocket server");

      if (chatId) {
        this.ws?.send(JSON.stringify({ action: "join_chat", chatid: chatId }));
        console.log(`Sent join_chat action for chat ID: ${chatId}`);
      } else {
        console.error("Chat ID is missing in the URL");
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "chat_connected") {
        if (data.history && Array.isArray(data.history)) {
          const processMessages = async () => {
            try {
              for (const message of data.history) {
                const timestamp = new Date(message.timestamp).toLocaleTimeString();
                const currentUserId = getUserId();

                const displayUsername = await this.getUsernameById(message.username);

                const isOwnMessage = message.username === currentUserId;
                const messageElement = this.createMessageElement(
                  timestamp,
                  displayUsername,
                  message.message,
                  isOwnMessage
                );

                chatBox.appendChild(messageElement);
              }
              chatBox.scrollTop = chatBox.scrollHeight;
            } catch (error) {
              console.error("Error processing chat history messages:", error);
            }
          };

          // Properly await the async function to handle errors and ensure completion
          processMessages().catch((error) => {
            console.error("Failed to process chat history:", error);
          });
        }
      } else if (data.type === "message") {
        const handleIncomingMessage = async () => {
          try {
            const timestamp = new Date(data.timestamp).toLocaleTimeString();
            const currentUserId = getUserId();

            const displayUsername = await this.getUsernameById(data.username);

            const isOwnMessage = data.username === currentUserId;
            const messageElement = this.createMessageElement(
              timestamp,
              displayUsername,
              data.message,
              isOwnMessage
            );

            chatBox.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight;
          } catch (error) {
            console.error("Error handling incoming message:", error);
          }
        };

        // Properly handle the async function to catch any errors
        handleIncomingMessage().catch((error) => {
          console.error("Failed to handle incoming message:", error);
        });
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
      // Clear cache when WebSocket connection is lost
      this.clearUserCache();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }
}

export default Chat;
