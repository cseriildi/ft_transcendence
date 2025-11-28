import { Router } from "../router/Router.js";
import { getUserId, getAccessToken } from "../utils/utils.js";
import { config } from "../config.js";

/**
 * Handles chat UI setup and chat partner information
 */
export class ChatUI {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  /**
   * Set up chat UI elements and handlers
   */
  public setupUI(
    chatId: string,
    onSendMessage: (message: string) => void,
    onBack: () => void
  ): void {
    const chatForm = document.getElementById("chat-form") as HTMLFormElement;
    const chatInput = document.getElementById("chat-input") as HTMLInputElement;
    const chatBox = document.getElementById("chat-box") as HTMLDivElement;
    const backBtn = document.getElementById("back-btn");

    chatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      if (message) {
        onSendMessage(message);
        chatInput.value = "";
      }
    });

    backBtn?.addEventListener("click", () => {
      onBack();
    });
  }

  /**
   * Set up chat partner information display
   */
  public async setupChatPartnerInfo(
    partnerUsername: string,
    chatId: string,
    onViewProfile: (userId: number) => void,
    onBlockUser: (userId: number, username: string) => void,
    onSendInvite: (userId: number, username: string) => void
  ): Promise<void> {
    const partnerUsernameElement = document.getElementById("partner-username");
    const partnerAvatarElement = document.getElementById("partner-avatar") as HTMLImageElement;
    const viewProfileBtn = document.getElementById("view-profile-btn");
    const blockUserBtn = document.getElementById("block-user-btn");

    if (partnerUsernameElement) {
      partnerUsernameElement.textContent = partnerUsername;
    }

    const currentUserId = getUserId();
    if (!currentUserId) {
      console.error("Current user ID not found");
      return;
    }

    const userIds = chatId.split("-").map((id) => parseInt(id));
    const partnerId = userIds.find((id) => id !== Number(currentUserId));

    if (!partnerId) {
      console.error("Partner ID could not be extracted from chat ID:", chatId);
      if (partnerAvatarElement) {
        partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
      }
      return;
    }

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

        if (partnerAvatarElement) {
          partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
          if (partner.avatar_url) {
            partnerAvatarElement.src = `${config.apiUrl}${partner.avatar_url}`;
          }
        }

        if (viewProfileBtn) {
          viewProfileBtn.addEventListener("click", () => {
            onViewProfile(partnerId);
          });
        }

        if (blockUserBtn) {
          blockUserBtn.addEventListener("click", async () => {
            const confirmed = confirm(
              `Are you sure you want to block ${partnerUsername}? You will no longer be able to send or receive messages from this user.`
            );
            if (confirmed) {
              onBlockUser(partnerId, partnerUsername);
            }
          });
        }

        const inviteBtn = document.getElementById("invite-btn");
        if (inviteBtn) {
          inviteBtn.addEventListener("click", async () => {
            onSendInvite(partnerId, partnerUsername);
          });
        }
      } else {
        console.error("Failed to fetch partner info:", await response.json());
        if (partnerAvatarElement) {
          partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
        }
      }
    } catch (error) {
      console.error("Error fetching partner info:", error);
      if (partnerAvatarElement) {
        partnerAvatarElement.alt = `${partnerUsername}'s avatar`;
      }
    }
  }
}
