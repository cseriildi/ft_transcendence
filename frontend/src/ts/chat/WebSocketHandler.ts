import { getUserId, getUsername } from "../utils/utils.js";
import { config } from "../config.js";
import { UserCache } from "./UserCache.js";
import { MessageRenderer } from "./MessageRenderer.js";

/**
 * Handles WebSocket connection and message handling
 */
export class WebSocketHandler {
  private ws: WebSocket | null = null;
  private userCache: UserCache;
  private messageRenderer: MessageRenderer;
  private pendingAutoMessage: string | null = null;

  constructor(userCache: UserCache, messageRenderer: MessageRenderer) {
    this.userCache = userCache;
    this.messageRenderer = messageRenderer;
  }

  /**
   * Connect to WebSocket and set up event handlers
   */
  public connect(chatId: string, chatBox: HTMLDivElement, onHistoryLoaded: () => void): void {
    this.ws = new WebSocket(`${config.wsUrl}/chat?userId=${getUserId()}&username=${getUserId()}`);

    this.ws.onopen = () => {
      console.log("Connected to WebSocket server");

      if (chatId) {
        this.ws?.send(JSON.stringify({ action: "join_chat", chatid: chatId }));
        console.log(`Sent join_chat action for chat ID: ${chatId}`);

        const urlParams = new URLSearchParams(window.location.search);
        const autoMessage = urlParams.get("autoMessage");
        if (autoMessage) {
          try {
            const decoded = decodeURIComponent(autoMessage);
            this.pendingAutoMessage = decoded;
          } catch (err) {
            console.error("Failed to decode autoMessage:", err);
          }
        }
      } else {
        console.error("Chat ID is missing in the URL");
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "chat_connected") {
        this.handleChatHistory(data, chatBox, chatId, onHistoryLoaded);
      } else if (data.type === "message") {
        this.handleIncomingMessage(data, chatBox);
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
      this.userCache.clear();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  /**
   * Handle chat history from server
   */
  private async handleChatHistory(
    data: any,
    chatBox: HTMLDivElement,
    chatId: string,
    onHistoryLoaded: () => void
  ): Promise<void> {
    if (!data.history || !Array.isArray(data.history)) {
      onHistoryLoaded();
      return;
    }

    try {
      data.history.sort((a: any, b: any) => {
        const ta = typeof a.timestamp === "number" ? a.timestamp : Date.parse(a.timestamp);
        const tb = typeof b.timestamp === "number" ? b.timestamp : Date.parse(b.timestamp);
        return ta - tb;
      });

      for (const message of data.history) {
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        const currentUserId = getUserId();
        const displayUsername = await this.userCache.getUsernameById(message.username);

        const isOwnMessage = message.username === currentUserId;
        const messageElement = this.messageRenderer.createMessageElement(
          timestamp,
          displayUsername,
          message.message,
          isOwnMessage
        );

        chatBox.appendChild(messageElement);
      }

      chatBox.scrollTop = chatBox.scrollHeight;

      // Send pending auto message after history is loaded
      if (this.pendingAutoMessage && this.ws && this.ws.readyState === WebSocket.OPEN) {
        await this.sendMessage(chatId, this.pendingAutoMessage, chatBox);

        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete("autoMessage");
        window.history.replaceState({}, "", currentUrl.toString());

        this.pendingAutoMessage = null;
      }

      onHistoryLoaded();
    } catch (error) {
      console.error("Error processing chat history messages:", error);
      onHistoryLoaded();
    }
  }

  /**
   * Handle incoming message from WebSocket
   */
  private async handleIncomingMessage(data: any, chatBox: HTMLDivElement): Promise<void> {
    try {
      const timestamp = new Date(data.timestamp).toLocaleTimeString();
      const currentUserId = getUserId();
      const displayUsername = await this.userCache.getUsernameById(data.username);

      const isOwnMessage = data.username === currentUserId;
      const messageElement = this.messageRenderer.createMessageElement(
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
  }

  /**
   * Send a message via WebSocket
   */
  public async sendMessage(
    chatId: string,
    message: string,
    chatBox: HTMLDivElement
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    try {
      this.ws.send(JSON.stringify({ action: "send_message", chatid: chatId, message }));

      const timestamp = new Date().toLocaleTimeString();
      const currentUsername = getUsername() || "Unknown";
      const messageElement = this.messageRenderer.createMessageElement(
        timestamp,
        currentUsername,
        message,
        true
      );

      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    console.log("Disconnecting from WebSocket...");
    this.ws?.close();
  }
}
