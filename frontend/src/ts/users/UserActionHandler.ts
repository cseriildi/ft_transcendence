import { FriendService } from "./FriendService.js";

export class UserActionHandler {
  constructor(
    private friendService: FriendService,
    private onActionComplete: () => void
  ) {}

  setupEventListeners(container: HTMLElement): void {
    // Use event delegation for all friend action buttons
    container.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "BUTTON") return;

      const action = target.dataset.action;
      const userId = target.dataset.userId;

      if (!action || !userId) return;

      const userIdNum = Number(userId);
      let success = false;

      switch (action) {
        case "add":
          success = await this.friendService.addFriend(userIdNum);
          break;
        case "delete":
        case "cancel":
          success = await this.friendService.deleteFriend(userIdNum);
          break;
        case "accept":
          success = await this.friendService.acceptFriend(userIdNum);
          break;
        case "decline":
          success = await this.friendService.declineFriend(userIdNum);
          break;
      }

      if (success) {
        this.onActionComplete();
      }
    });
  }
}
