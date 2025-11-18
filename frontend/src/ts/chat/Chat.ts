import { Router } from "../router/Router.js";
import { getUserId, isUserAuthorized, getUsername, getAccessToken } from "../utils/utils.js";
import { config } from "../config.js";

export class Chat {
  private router: Router;
  private ws: WebSocket | null = null;
  private userCache: Map<string, string> = new Map(); // userId -> username cache

  constructor(router: Router) {
    this.router = router;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private createMessageElement(timestamp: string, username: string, message: string, isOwnMessage: boolean): HTMLElement {
    const messageElement = document.createElement("div");
    
    // Escape all user-provided content
    const escapedUsername = this.escapeHtml(username);
    const escapedMessage = this.escapeHtml(message);
    
    const colorClass = isOwnMessage ? "text-neon-pink" : "text-neon-green";
    const alignmentClasses = isOwnMessage ? "mb-2 text-right ml-auto max-w-s" : "mb-2 text-left mr-auto max-w-s";
    
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
    if (this.userCache.size > 0) {
      return;
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

        users.forEach((user: { id: number; username: string }) => {
          this.userCache.set(user.id.toString(), user.username);
        });
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

  initPage(): void {
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

    if (!chatId) {
      console.error("Chat ID is missing in the URL");
      return;
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
      this.ws?.close();
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
            for (const message of data.history) {
              const timestamp = new Date(message.timestamp).toLocaleTimeString();
              const currentUserId = getUserId();

              const displayUsername = await this.getUsernameById(message.username);

              const isOwnMessage = message.username === currentUserId;
              const messageElement = this.createMessageElement(timestamp, displayUsername, message.message, isOwnMessage);

              chatBox.appendChild(messageElement);
            }
            chatBox.scrollTop = chatBox.scrollHeight;
          };

          processMessages();
        }
      } else if (data.type === "message") {
        const handleIncomingMessage = async () => {
          const timestamp = new Date(data.timestamp).toLocaleTimeString();
          const currentUserId = getUserId();

          const displayUsername = await this.getUsernameById(data.username);

          const isOwnMessage = data.username === currentUserId;
          const messageElement = this.createMessageElement(timestamp, displayUsername, data.message, isOwnMessage);

          chatBox.appendChild(messageElement);
          chatBox.scrollTop = chatBox.scrollHeight;
        };

        handleIncomingMessage();
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }
}

export default Chat;
