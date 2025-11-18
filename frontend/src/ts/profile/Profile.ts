import { Router } from "../router/Router.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
import { config } from "../config.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

export class Profile {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const editBtn = document.getElementById("edit-btn");
    const backBtn = document.getElementById("back-btn");
    const userName = document.getElementById("user-name");
    const userAvatar = document.getElementById("user-avatar") as HTMLImageElement;
    const friendsListContainer = document.getElementById("friends-list");
    const userEmail = document.getElementById("user-email");
    const findFriendsBtn = document.getElementById("find-friends-btn");
    let users: Array<{ id: number; username: string; avatar_url: string; last_seen?: string }> | undefined;

    findFriendsBtn?.addEventListener("click", () => this.router.navigate("/users"));

    backBtn?.addEventListener("click", () => this.router.navigate("/"));
    editBtn?.addEventListener("click", () => this.router.navigate("/edit"));

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${getUserId()}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (userName) userName.innerHTML = data.data.username;
        if (userEmail) userEmail.innerHTML = data.data.email;
        if (userAvatar && data.data.avatar_url) {
          userAvatar.src = `${config.apiUrl}${data.data.avatar_url}`;
        }
      } else {
        console.error("Failed to fetch user data", await response.json());
      }
    } catch (error) {
      console.error("Error fetching user data", error);
    }

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
        if (friendsListContainer) {
          friendsListContainer.innerHTML = "";
          console.log(data);
          if (data.data.friends.length === 0) {
            friendsListContainer.innerHTML = "<p>You don't have friends yet</p>";
            friendsListContainer.classList.add("text-white");
          } else {
            data.data.friends.forEach(
              (friend: {
                user_id: number;
                username: string;
                status: string;
                is_inviter: boolean;
                is_online: boolean;
              }) => {
                // Find the avatar URL from the users list
                const userWithAvatar = users?.find((u: any) => u.id === friend.user_id);
                const avatarUrl =
                  userWithAvatar?.avatar_url || "/uploads/avatars/default/default-avatar.png";

                const isOnline = friend.is_online;
                
                const isPending = friend.status === "pending";
                const isInviter = friend.is_inviter;

                const userItem = document.createElement("div");
                userItem.classList.add(
                  "user-item",
                  "flex",
                  "items-center",
                  "space-x-4",
                  "p-2",
                  "hover:bg-neon-pink",
                  "cursor-pointer",
                  "w-64",
                  "rounded-lg",
                  "text-white",
                  "relative"
                );

                // Avatar container with online indicator
                const avatarContainer = document.createElement("div");
                avatarContainer.classList.add("relative", "min-w-[2rem]");

                const avatar = document.createElement("img");
                avatar.src = `${config.apiUrl}${avatarUrl}`;
                avatar.alt = `${friend.username}'s avatar`;
                avatar.classList.add("w-8", "h-8", "rounded-full");

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

                const usernameContainer = document.createElement("div");
                usernameContainer.classList.add("flex", "flex-col", "flex-1", "min-w-0");

                const usernameRow = document.createElement("div");
                usernameRow.classList.add("flex", "items-center", "gap-2");

                const username = document.createElement("span");
                username.textContent = friend.username;
                username.classList.add("text-sm", "font-medium", "truncate");

                usernameRow.appendChild(username);

                // Add online status text
                if (!isPending) {
                  const onlineStatus = document.createElement("span");
                  onlineStatus.textContent = isOnline ? "Online" : "Offline";
                  onlineStatus.classList.add(
                    "text-xs",
                    "px-1.5",
                    "py-0.5",
                    "rounded",
                    isOnline ? "text-green-400" : "text-gray-400"
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

                userItem.appendChild(avatarContainer);
                userItem.appendChild(usernameContainer);
                friendsListContainer.appendChild(userItem);

                userItem.addEventListener("click", () => {
                  const currentUserId = getUserId();
                  const friendId = friend.user_id;
                  if (currentUserId === null) {
                    console.error("Current user ID is null, cannot create chat ID.");
                    return;
                  }
                  const chatId = [Number(currentUserId), Number(friendId)]
                    .sort((a, b) => a - b)
                    .join("-");
                  this.router.navigate(`/chat?chatId=${chatId}&username=${friend.username}`);
                });
              }
            );
          }
        }
      } else {
        console.error("Failed to fetch user list", await response.json());
      }
    } catch (error) {
      console.error("Error fetching user list", error);
    }
  }
}
