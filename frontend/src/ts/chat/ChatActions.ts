import { getAccessToken, getUserId } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { config } from "../config.js";
import { MessageRenderer } from "./MessageRenderer.js";

/**
 * Handles user actions in chat (blocking, inviting, etc.)
 */
export class ChatActions {
  private messageRenderer: MessageRenderer;

  constructor(messageRenderer: MessageRenderer) {
    this.messageRenderer = messageRenderer;
  }

  /**
   * Block a user in chat
   */
  public async blockUser(
    partnerId: number,
    partnerUsername: string,
    onSuccess: () => void
  ): Promise<void> {
    const currentUserId = getUserId();
    if (!currentUserId) {
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
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to block user. Please try again.");
      }
    } catch (error) {
      alert("An error occurred while blocking the user. Please try again.");
    }
  }

  /**
   * Send a game invitation to chat partner
   */
  public async sendGameInvite(
    partnerId: number,
    partnerUsername: string,
    chatId: string,
    onMessageReady: (message: string) => void
  ): Promise<void> {
    try {
      const currentUserId = getUserId();
      if (!currentUserId) {
        return;
      }

      const response = await fetchWithRefresh(`${config.apiUrl}/api/game-invites/${partnerId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.message || "Failed to create invitation");
        return;
      }

      const body = await response.json();
      const gameId = body.data?.game_id;
      if (!gameId) {
        alert("Server did not return a game id");
        return;
      }

      const gameLink = `${location.origin}/pong?mode=friend&gameId=${gameId}`;
      const message = `Game Invitation! 🎮 ${gameLink} 🎮`;

      onMessageReady(message);
    } catch (error) {
      alert("Failed to send invitation. Please try again.");
    }
  }
}
