import { config } from "../config.js";
import { getUserId } from "../utils/utils.js";
import { User } from "./UserService.js";
import { Friend } from "./FriendService.js";
import { i18n } from "../utils/i18n.js";

export interface FriendStatus {
  isFriend: boolean;
  isPending: boolean;
  isInviter: boolean;
  isDeclined: boolean;
}

export class UserListRenderer {
  constructor(private router: any) {}

  render(users: User[], friends: Friend[] | undefined, container: HTMLElement): void {
    container.innerHTML = "";

    const currentUserId = Number(getUserId());

    // Filter out current user
    const otherUsers = users.filter((user) => user.id !== currentUserId);

    if (otherUsers.length === 0) {
      container.innerHTML = `<p class="text-center">${i18n.t("users.noOtherUsers")}</p>`;
      container.classList.add("text-white");
      return;
    }

    otherUsers.forEach((user) => {
      const friendStatus = this.getFriendStatus(user.id, friends);
      const userItem = this.createUserItem(user, friendStatus);
      container.appendChild(userItem);
    });
  }

  private getFriendStatus(userId: number, friends: Friend[] | undefined): FriendStatus {
    const friendStatus = friends?.find((friend) => friend.user_id === userId);

    return {
      isFriend: friendStatus?.status === "accepted",
      isPending: friendStatus?.status === "pending",
      isInviter: friendStatus?.is_inviter === true,
      isDeclined: friendStatus?.status === "declined",
    };
  }

  private createUserItem(user: User, status: FriendStatus): HTMLDivElement {
    const userItem = document.createElement("div");
    userItem.classList.add(
      "flex",
      "flex-col",
      "sm:flex-row",
      "sm:items-center",
      "sm:justify-between",
      "mb-4",
      "p-3",
      "rounded-lg",
      "hover:bg-blue-600",
      "gap-3",
      "sm:gap-0",
      "cursor-pointer"
    );

    const userInfo = this.createUserInfo(user);
    const buttonContainer = this.createButtonContainer(user, status);

    userItem.appendChild(userInfo);
    userItem.appendChild(buttonContainer);

    // Add click handler to entire user item
    userItem.addEventListener("click", (e) => {
      // Only navigate if the click wasn't on a button
      if ((e.target as HTMLElement).tagName !== "BUTTON") {
        this.router.navigate(`/profile?userId=${user.id}`);
      }
    });

    return userItem;
  }

  private createUserInfo(user: User): HTMLDivElement {
    const userInfo = document.createElement("div");
    userInfo.classList.add("flex", "items-center");

    const avatar = document.createElement("img");
    avatar.src = `${config.apiUrl}${user.avatar_url}`;
    avatar.alt = `${user.username}'s avatar`;
    avatar.classList.add("w-12", "h-12", "rounded-full", "mr-4");

    const username = document.createElement("span");
    username.textContent = user.username;
    username.classList.add("text-white", "mr-4", "max-w-[150px]", "truncate", "block");

    userInfo.appendChild(avatar);
    userInfo.appendChild(username);

    return userInfo;
  }

  private createButtonContainer(user: User, status: FriendStatus): HTMLDivElement {
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add(
      "flex",
      "flex-wrap",
      "gap-2",
      "w-full",
      "sm:w-auto",
      "justify-center",
      "sm:justify-end"
    );

    // Add friendship action buttons based on status
    if (status.isFriend) {
      buttonContainer.appendChild(this.createDeleteButton(user.id));
    } else if (status.isPending && status.isInviter) {
      buttonContainer.appendChild(this.createCancelButton(user.id));
    } else if (status.isPending && !status.isInviter) {
      buttonContainer.appendChild(this.createAcceptButton(user.id));
      buttonContainer.appendChild(this.createDeclineButton(user.id));
    } else if (status.isDeclined && status.isInviter) {
      // If I sent the invite and it was declined, disable the button
      buttonContainer.appendChild(this.createDisabledAddButton(user.id));
    } else if (status.isDeclined && !status.isInviter) {
      // If they sent the invite and I declined, allow re-adding (delete first, then add)
      buttonContainer.appendChild(this.createReAddButton(user.id));
    } else {
      buttonContainer.appendChild(this.createAddButton(user.id));
    }

    // Always add chat button
    buttonContainer.appendChild(this.createChatButton(user));

    return buttonContainer;
  }

  private createDeleteButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("users.deleteFriend");
    button.classList.add(
      "bg-red-600",
      "hover:bg-red-700",
      "text-white",
      "font-bold",
      "py-1",
      "px-3",
      "rounded",
      "transition"
    );
    button.dataset.action = "delete";
    button.dataset.userId = userId.toString();
    return button;
  }

  private createCancelButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("users.cancelRequest");
    button.classList.add(
      "bg-gray-600",
      "hover:bg-gray-700",
      "text-white",
      "font-bold",
      "py-1",
      "px-3",
      "rounded",
      "transition"
    );
    button.dataset.action = "cancel";
    button.dataset.userId = userId.toString();
    return button;
  }

  private createAcceptButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("users.accept");
    button.classList.add(
      "bg-neon-green",
      "hover:bg-green-600",
      "text-purple-900",
      "font-bold",
      "py-1",
      "px-3",
      "rounded",
      "transition"
    );
    button.dataset.action = "accept";
    button.dataset.userId = userId.toString();
    return button;
  }

  private createDeclineButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("users.decline");
    button.classList.add(
      "bg-red-600",
      "hover:bg-red-700",
      "text-white",
      "font-bold",
      "py-1",
      "px-3",
      "rounded",
      "transition"
    );
    button.dataset.action = "decline";
    button.dataset.userId = userId.toString();
    return button;
  }

  private createAddButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("users.addFriend");
    button.classList.add("btn-green");
    button.dataset.action = "add";
    button.dataset.userId = userId.toString();
    return button;
  }

  private createDisabledAddButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = "Request Declined";
    button.classList.add(
      "bg-gray-500",
      "text-white",
      "font-bold",
      "py-1",
      "px-3",
      "rounded",
      "cursor-not-allowed",
      "opacity-50"
    );
    button.disabled = true;
    button.dataset.userId = userId.toString();
    return button;
  }

  private createReAddButton(userId: number): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("users.addFriend");
    button.classList.add("btn-green");
    button.dataset.action = "readd";
    button.dataset.userId = userId.toString();
    return button;
  }

  private createChatButton(user: User): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = i18n.t("chat.title");
    button.classList.add("btn-pink");
    button.addEventListener("click", () => {
      const currentUserId = getUserId();
      const friendId = user.id;
      const chatId = [currentUserId, friendId].sort((a, b) => Number(a) - Number(b)).join("-");
      this.router.navigate(`/chat?chatId=${chatId}&username=${user.username}`);
    });
    return button;
  }
}
