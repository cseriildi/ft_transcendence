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

  private async loadAllUsers(): Promise<void> {
    if (this.userCache.size > 0) {
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/users`, {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const users = userData.data;
        
        users.forEach((user: { id: number; username: string }) => {
          this.userCache.set(user.id.toString(), user.username);
        });
      } else {
        console.error('Failed to fetch users list');
      }
    } catch (error) {
      console.error('Error fetching users list:', error);
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

        const messageElement = document.createElement("div");
        const timestamp = new Date().toLocaleTimeString();
        const currentUsername = getUsername();
        messageElement.innerHTML = `<span class="text-neon-pink">[${timestamp}] ${currentUsername}:</span><br><span class="text-white">${message}</span>`;
        messageElement.classList.add("mb-2", "text-right", "ml-auto", "max-w-s");
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
              const messageElement = document.createElement("div");
              const timestamp = new Date(message.timestamp).toLocaleTimeString();
              const currentUsername = getUsername();
              const currentUserId = getUserId();
              
              const displayUsername = await this.getUsernameById(message.username);
              
              const isOwnMessage = message.username === currentUserId;
              
              if (isOwnMessage) {
                messageElement.innerHTML = `<span class="text-neon-pink">[${timestamp}] ${displayUsername}:</span><br><span class="text-white">${message.message}</span>`;
                messageElement.classList.add("mb-2", "text-right", "ml-auto", "max-w-s");
              } else {
                messageElement.innerHTML = `<span class="text-neon-green">[${timestamp}] ${displayUsername}:</span><br><span class="text-white">${message.message}</span>`;
                messageElement.classList.add("mb-2", "text-left", "mr-auto", "max-w-s");
              }
              
              chatBox.appendChild(messageElement);
            }
            chatBox.scrollTop = chatBox.scrollHeight;
          };
          
          processMessages();
        }
      } else if (data.type === "message") {
        const handleIncomingMessage = async () => {
          const messageElement = document.createElement("div");
          const timestamp = new Date(data.timestamp).toLocaleTimeString();
          const currentUserId = getUserId();
          
          const displayUsername = await this.getUsernameById(data.username);
          
          const isOwnMessage = data.username === currentUserId;
          
          if (isOwnMessage) {
            messageElement.innerHTML = `<span class="text-neon-pink">[${timestamp}] ${displayUsername}:</span><br><span class="text-white">${data.message}</span>`;
            messageElement.classList.add("mb-2", "text-right", "ml-auto", "max-w-s");
          } else {
            messageElement.innerHTML = `<span class="text-neon-green">[${timestamp}] ${displayUsername}:</span><br><span class="text-white">${data.message}</span>`;
            messageElement.classList.add("mb-2", "text-left", "mr-auto", "max-w-s");
          }
          
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
