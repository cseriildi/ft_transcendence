import { FriendService } from "./FriendService.js";

export class UserActionHandler {
  private clickHandler: ((e: Event) => Promise<void>) | null = null;
  private attachedContainer: HTMLElement | null = null;

  constructor(
    private friendService: FriendService,
    private onActionComplete: () => void
  ) {}

  setupEventListeners(container: HTMLElement): void {
    // Remove listener from previous container if it exists
    if (this.clickHandler && this.attachedContainer) {
      this.attachedContainer.removeEventListener("click", this.clickHandler);
    }

    // Create and store the handler
    this.clickHandler = async (e: Event) => {
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
        case "readd":
          // First delete the declined request, then send a new invite
          const deleteSuccess = await this.friendService.deleteFriend(userIdNum);
          if (deleteSuccess) {
            success = await this.friendService.addFriend(userIdNum);
          }
          break;
      }

      if (success) {
        this.onActionComplete();
      }
    };

    // Add listener to new container and store reference
    container.addEventListener("click", this.clickHandler);
    this.attachedContainer = container;
  }
}
