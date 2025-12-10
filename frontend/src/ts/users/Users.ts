import { isUserAuthorized } from "../utils/utils.js";
import { FriendService } from "./FriendService.js";
import { UserService } from "./UserService.js";
import { UserListRenderer } from "./UserListRenderer.js";
import { UserActionHandler } from "./UserActionHandler.js";
import { i18n } from "../utils/i18n.js";

export class Users {
  private friendService: FriendService;
  private userService: UserService;
  private userListRenderer: UserListRenderer;
  private userActionHandler: UserActionHandler;
  private lastAttachedContainer: HTMLElement | null = null;
  private languageChangeListener: (() => void) | null = null;

  constructor(private router: any) {
    this.friendService = new FriendService();
    this.userService = new UserService();
    this.userListRenderer = new UserListRenderer(router);
    this.userActionHandler = new UserActionHandler(this.friendService, () =>
      this.loadAndRenderUsers()
    );
  }

  public destroy(): void {
    if (this.languageChangeListener) {
      window.removeEventListener("languageChanged", this.languageChangeListener);
      this.languageChangeListener = null;
    }
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    this.setupBackButton();
    this.setupLanguageListener();
    await this.loadAndRenderUsers();
  }

  private setupBackButton(): void {
    const backBtn = document.getElementById("back-btn");
    backBtn?.addEventListener("click", () => this.router.navigate("/profile"));
  }

  private setupUserActionListeners(): void {
    const usersListContainer = document.getElementById("user-list");
    if (!usersListContainer) return;

    // If we already attached to this exact DOM element, skip
    if (this.lastAttachedContainer === usersListContainer) return;

    // Attach to the current container (handles DOM replacement after navigation)
    this.userActionHandler.setupEventListeners(usersListContainer);
    this.lastAttachedContainer = usersListContainer;
  }

  private async loadAndRenderUsers(): Promise<void> {
    // Fetch friends status and users in parallel
    const [friendsResponse, users] = await Promise.all([
      this.friendService.getFriendsStatus(),
      this.userService.getUsers(),
    ]);

    const usersListContainer = document.getElementById("user-list");
    if (!usersListContainer) {
      console.error("User list container not found");
      return;
    }

    // Render the user list
    const friends = friendsResponse?.data?.friends;
    this.userListRenderer.render(users, friends, usersListContainer);

    // Set up action listeners after rendering
    this.setupUserActionListeners();
  }

  private setupLanguageListener(): void {
    if (this.languageChangeListener) {
      window.removeEventListener("languageChanged", this.languageChangeListener);
    }

    this.languageChangeListener = async () => {
      // Only re-render if we're still on the users page
      const usersListContainer = document.getElementById("user-list");
      if (!usersListContainer) {
        console.log("Not on users page, skipping re-render");
        return;
      }

      console.log("Language changed, re-rendering users page...");
      await this.loadAndRenderUsers();
    };

    window.addEventListener("languageChanged", this.languageChangeListener);
  }
}

export default Users;
