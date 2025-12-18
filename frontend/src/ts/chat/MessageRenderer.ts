/**
 * Handles message rendering and URL parsing
 */
import { i18n } from "../utils/i18n.js";

export class MessageRenderer {
  constructor() {
    window.addEventListener("languageChanged", () => this.updateInviteAnchors());
  }

  private updateInviteAnchors(): void {
    const anchors = document.querySelectorAll<HTMLAnchorElement>("a[data-game-invite]");
    anchors.forEach((a) => {
      const template = i18n.t("chat.gameInvitationMessage");
      const joinLabel = i18n.t("chat.joinGame");
      const inviteText = template.replace("{{link}}", joinLabel);
      a.textContent = inviteText;
      a.title = inviteText;
      a.setAttribute("aria-label", inviteText);
    });
  }
  /**
   * Create a message element with styling and link parsing
   */
  public createMessageElement(
    timestamp: string,
    username: string,
    message: string,
    isOwnMessage: boolean
  ): HTMLElement {
    const messageElement = document.createElement("div");

    const colorClass = isOwnMessage ? "text-neon-pink" : "text-neon-green";
    const alignmentClasses = isOwnMessage
      ? "mb-2 text-right ml-auto max-w-s"
      : "mb-2 text-left mr-auto max-w-s";

    const timestampSpan = document.createElement("span");
    timestampSpan.className = colorClass;
    timestampSpan.textContent = `[${timestamp}] ${username}:`;

    messageElement.appendChild(timestampSpan);
    messageElement.appendChild(document.createElement("br"));

    const messageSpan = this.createMessageContent(message);
    messageElement.appendChild(messageSpan);

    messageElement.className = alignmentClasses;

    return messageElement;
  }

  /**
   * Parse message for URLs and create clickable links
   */
  private createMessageContent(text: string): HTMLSpanElement {
    const messageSpan = document.createElement("span");
    messageSpan.className = "text-white break-words";

    const isGameInvite = text.includes("__GAME_INVITE__:");
    const cleanedText = isGameInvite ? text.replace("__GAME_INVITE__:", "") : text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = cleanedText.split(urlRegex);

    parts.forEach((part) => {
      if (/https?:\/\/[^\s]+/.test(part)) {
        let url: URL | null = null;
        try {
          url = new URL(part);
        } catch (e) {
          url = null;
        }

        if (url && (url.protocol === "http:" || url.protocol === "https:")) {
          const link = document.createElement("a");
          link.href = part;
          link.target = "_blank";
          link.rel = "noopener noreferrer";


          link.textContent = part;
          link.className = "text-blue-400 hover:underline cursor-pointer";

          if (isGameInvite && part.includes("/pong?mode=friend&gameId=")) {

            const template = i18n.t("chat.gameInvitationMessage");
            const joinLabel = i18n.t("chat.joinGame");
            const inviteText = template.replace("{{link}}", joinLabel);

            const inviteAnchor = document.createElement("a");
            inviteAnchor.href = part;
            inviteAnchor.target = "_blank";
            inviteAnchor.rel = "noopener noreferrer";
            inviteAnchor.className = "text-blue-400 hover:underline cursor-pointer";
            inviteAnchor.textContent = inviteText;
            inviteAnchor.title = inviteText;
            inviteAnchor.setAttribute("aria-label", inviteText);
            inviteAnchor.setAttribute("data-game-invite", "true");

            messageSpan.appendChild(inviteAnchor);
          } else {
            messageSpan.appendChild(link);
          }
        } else {
          const textNode = document.createTextNode(part);
          messageSpan.appendChild(textNode);
        }
      } else {
        const textNode = document.createTextNode(part);
        messageSpan.appendChild(textNode);
      }
    });

    return messageSpan;
  }
}
