/**
 * Handles message rendering and URL parsing
 */
export class MessageRenderer {
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

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

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

          if (part.includes("/pong?mode=friend&gameId=")) {
            link.textContent = "Join Game";
          } else {
            link.textContent = part;
          }
          link.className = "text-blue-400 hover:underline cursor-pointer";

          messageSpan.appendChild(link);
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
