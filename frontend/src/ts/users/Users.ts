import { isUserAuthorized } from "../utils/utils.js";
import { FriendService } from "./FriendService.js";
import { UserService } from "./UserService.js";
import { UserListRenderer } from "./UserListRenderer.js";
import { UserActionHandler } from "./UserActionHandler.js";

export class Users {
  private friendService: FriendService;
  private userService: UserService;
  private userListRenderer: UserListRenderer;
  private userActionHandler: UserActionHandler;

  constructor(private router: any) {
    this.friendService = new FriendService();
    this.userService = new UserService();
    this.userListRenderer = new UserListRenderer(router, () => this.initPage());
    this.userActionHandler = new UserActionHandler(this.friendService, () => this.initPage());
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    this.setupBackButton();
    await this.loadAndRenderUsers();
  }

  private setupBackButton(): void {
    const backBtn = document.getElementById("back-btn");
    backBtn?.addEventListener("click", () => this.router.navigate("/profile"));
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

    // Setup event handlers for user actions
    this.userActionHandler.setupEventListeners(usersListContainer);
  }
}

export default Users;
