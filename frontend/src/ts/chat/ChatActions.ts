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
        onSuccess();
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
        console.error("No current user ID; cannot send invite");
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
        console.error("Failed to create friend game invite", err);
        alert(err.message || "Failed to create invitation");
        return;
      }

      const body = await response.json();
      const gameId = body.data?.game_id;
      if (!gameId) {
        console.error("API did not return gameId", body);
        alert("Server did not return a game id");
        return;
      }

      const gameLink = `${location.origin}/pong?mode=friend&gameId=${gameId}`;
      const message = `Game Invitation! 🎮 ${gameLink} 🎮`;

      onMessageReady(message);
    } catch (error) {
      console.error("Error sending game invite:", error);
      alert("Failed to send invitation. Please try again.");
    }
  }
}
