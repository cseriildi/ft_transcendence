import { Router } from "../router/Router.js";
import { config } from "../config.js";
import { getAccessToken, getUserId } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

/**
 * Handles friends list display
 */
export class FriendsList {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  public async loadFriendsList(friendsListContainer: HTMLElement | null): Promise<void> {
    if (!friendsListContainer) {
      return;
    }

    let users:
      | Array<{ id: number; username: string; avatar_url: string; last_seen?: string }>
      | undefined;

    // Fetch all users for avatar URLs
    try {
      const usersResponse = await fetchWithRefresh(`${config.apiUrl}/api/users`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        users = usersData.data;
      } else {
        console.error("Failed to fetch users", await usersResponse.json());
      }
    } catch (error) {
      console.error("Error fetching users", error);
    }

    // Fetch friends status
    try {
      const response = await fetch(`${config.apiUrl}/api/friends/status`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        friendsListContainer.innerHTML = "";

        // Filter out declined friendships - only show accepted and pending
        const activeFriends = data.data.friends.filter(
          (friend: { status: string }) =>
            friend.status === "accepted" || friend.status === "pending"
        );

        if (activeFriends.length === 0) {
          friendsListContainer.innerHTML = '<p class="text-center">You don\'t have friends yet</p>';
          friendsListContainer.classList.add("text-white");
        } else {
          activeFriends.forEach(
            (friend: {
              user_id: number;
              username: string;
              status: string;
              is_inviter: boolean;
              is_online: boolean;
            }) => {
              const friendElement = this.createFriendElement(friend, users);
              friendsListContainer.appendChild(friendElement);
            }
          );
        }
      } else {
        console.error("Failed to fetch user list", await response.json());
      }
    } catch (error) {
      console.error("Error fetching user list", error);
    }
  }

  private createFriendElement(
    friend: {
      user_id: number;
      username: string;
      status: string;
      is_inviter: boolean;
      is_online: boolean;
    },
    users:
      | Array<{ id: number; username: string; avatar_url: string; last_seen?: string }>
      | undefined
  ): HTMLDivElement {
    // Find the avatar URL from the users list
    const userWithAvatar = users?.find((u: any) => u.id === friend.user_id);
    const avatarUrl = userWithAvatar?.avatar_url || "/uploads/avatars/default/default-avatar.png";

    const isOnline = friend.is_online;
    const isPending = friend.status === "pending";
    const isInviter = friend.is_inviter;

    const userItem = document.createElement("div");
    userItem.classList.add(
      "user-item",
      "flex",
      "items-center",
      "space-x-2",
      "sm:space-x-4",
      "p-2",
      "sm:p-3",
      "hover:bg-blue-600",
      "cursor-pointer",
      "w-full",
      "max-w-md",
      "rounded-lg",
      "text-white",
      "relative",
      "min-w-0"
    );

    // Avatar container with online indicator
    const avatarContainer = this.createAvatarContainer(
      friend.username,
      avatarUrl,
      isOnline,
      isPending
    );

    // Username container
    const usernameContainer = this.createUsernameContainer(
      friend.username,
      isOnline,
      isPending,
      isInviter
    );

    // Chat button
    const chatButton = this.createChatButton(friend);
    // Invite button (shown only for established friends)
    const inviteButton = this.createInviteButton(friend);

    userItem.appendChild(avatarContainer);
    userItem.appendChild(usernameContainer);
    userItem.appendChild(chatButton);
    if (inviteButton) userItem.appendChild(inviteButton);

    // Make the entire user item clickable to view profile
    userItem.addEventListener("click", () => {
      this.router.navigate(`/profile?userId=${friend.user_id}`);
    });

    return userItem;
  }

  private createAvatarContainer(
    username: string,
    avatarUrl: string,
    isOnline: boolean,
    isPending: boolean
  ): HTMLDivElement {
    const avatarContainer = document.createElement("div");
    avatarContainer.classList.add("relative", "min-w-[2rem]", "flex-shrink-0");

    const avatar = document.createElement("img");
    avatar.src = `${config.apiUrl}${avatarUrl}`;
    avatar.alt = `${username}'s avatar`;
    avatar.classList.add("w-8", "h-8", "sm:w-10", "sm:h-10", "rounded-full");

    // Add opacity if pending
    if (isPending) {
      avatar.classList.add("opacity-50");
    }

    avatarContainer.appendChild(avatar);

    // Add online indicator
    if (isOnline && !isPending) {
      const onlineIndicator = document.createElement("div");
      onlineIndicator.classList.add(
        "absolute",
        "-bottom-0.5",
        "-right-0.5",
        "w-3",
        "h-3",
        "bg-green-500",
        "rounded-full",
        "border-2",
        "border-gray-800"
      );
      avatarContainer.appendChild(onlineIndicator);
    }

    return avatarContainer;
  }

  private createUsernameContainer(
    username: string,
    isOnline: boolean,
    isPending: boolean,
    isInviter: boolean
  ): HTMLDivElement {
    const usernameContainer = document.createElement("div");
    usernameContainer.classList.add("flex", "flex-col", "flex-1", "min-w-0");

    const usernameRow = document.createElement("div");
    usernameRow.classList.add("flex", "items-center", "gap-2");

    const usernameSpan = document.createElement("span");
    usernameSpan.textContent = username;
    usernameSpan.classList.add("text-xs", "sm:text-sm", "font-medium", "truncate");

    usernameRow.appendChild(usernameSpan);

    // Add online status text
    if (!isPending) {
      const onlineStatus = document.createElement("span");
      onlineStatus.textContent = isOnline ? "Online" : "Offline";
      onlineStatus.classList.add(
        "text-xs",
        "px-1",
        "sm:px-1.5",
        "py-0.5",
        "rounded",
        "flex-shrink-0",
        isOnline ? "text-neon-green" : "text-neon-pink"
      );
      usernameRow.appendChild(onlineStatus);
    }

    usernameContainer.appendChild(usernameRow);

    // Add pending indicator
    if (isPending) {
      const statusLabel = document.createElement("span");
      statusLabel.textContent = isInviter ? "(Request sent)" : "(Pending approval)";
      statusLabel.classList.add("text-xs", "text-gray-400", "italic");
      usernameContainer.appendChild(statusLabel);
    }

    return usernameContainer;
  }

  private createChatButton(friend: {
    user_id: number;
    username: string;
    status: string;
    is_inviter: boolean;
    is_online: boolean;
  }): HTMLButtonElement {
    const chatButton = document.createElement("button");
    chatButton.textContent = "Chat";
    chatButton.title = "Start Chat";
    chatButton.classList.add("btn-pink");

    chatButton.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the profile navigation
      const currentUserId = getUserId();
      const friendId = friend.user_id;
      if (currentUserId === null) {
        console.error("Current user ID is null, cannot create chat ID.");
        return;
      }
      const chatId = [Number(currentUserId), Number(friendId)].sort((a, b) => a - b).join("-");
      this.router.navigate(`/chat?chatId=${chatId}&username=${friend.username}`);
    });

    return chatButton;
  }

  private createInviteButton(friend: {
    user_id: number;
    username: string;
    status: string;
    is_inviter: boolean;
    is_online: boolean;
  }): HTMLButtonElement | null {
    // Only show Invite for established/accepted friends
    if (friend.status !== "accepted") return null;

    const inviteButton = document.createElement("button");
    inviteButton.textContent = "Invite";
    inviteButton.title = "Invite to play";
    inviteButton.classList.add("btn-green", "ml-2");

    inviteButton.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the profile navigation
      (async () => {
        try {
          const currentUserId = getUserId();
          if (!currentUserId) {
            console.error("No current user ID; cannot send invite");
            return;
          }

          inviteButton.disabled = true;
          inviteButton.textContent = "Sending...";

          const response = await fetchWithRefresh(
            `${config.apiUrl}/api/game-invites/${friend.user_id}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getAccessToken()}`,
              },
              credentials: "include",
              body: JSON.stringify({}),
            }
          );

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error("Failed to create friend game invite", err);
            inviteButton.disabled = false;
            inviteButton.textContent = "Invite";
            alert(err.message || "Failed to create invitation");
            return;
          }

          const body = await response.json();
          const gameId = body.data?.game_id;
          if (!gameId) {
            console.error("API did not return gameId", body);
            inviteButton.disabled = false;
            inviteButton.textContent = "Invite";
            alert("Server did not return a game id");
            return;
          }

          // Prepare chat navigation: open or create 1:1 chat and send the game link automatically
          const chatId = [Number(currentUserId), Number(friend.user_id)]
            .sort((a, b) => a - b)
            .join("-");
          const gameLink = `${location.origin}/pong?mode=friend&gameId=${gameId}`;
          const message = `Game Invitation! 🎮 ${gameLink} 🎮`;

          // Navigate to chat page with an autoMessage parameter
          const encoded = encodeURIComponent(message);
          this.router.navigate(
            `/chat?chatId=${chatId}&username=${friend.username}&autoMessage=${encoded}`
          );
        } catch (err) {
          console.error("Error sending invite:", err);
          inviteButton.disabled = false;
          inviteButton.textContent = "Invite";
          alert("Failed to send invitation. Please try again.");
        }
      })();
    });

    inviteButton.setAttribute("data-user-id", String(friend.user_id));

    return inviteButton;
  }
}
