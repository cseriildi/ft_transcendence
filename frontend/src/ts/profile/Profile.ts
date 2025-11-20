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

    // Get query parameters to check if we're viewing another user's profile
    const queryParams = this.router.getQueryParams();
    const viewingUserId = queryParams.userId;
    const currentUserId = getUserId();
    const isOwnProfile = !viewingUserId || viewingUserId === currentUserId?.toString();

    const editBtn = document.getElementById("edit-btn");
    const chatBtn = document.getElementById("chat-btn");
    const backBtn = document.getElementById("back-btn");
    const userName = document.getElementById("user-name");
    const userAvatar = document.getElementById("user-avatar") as HTMLImageElement;
    const friendsListContainer = document.getElementById("friends-list");
    const userEmail = document.getElementById("user-email");
    const findFriendsBtn = document.getElementById("find-friends-btn");
    const pageTitle = document.querySelector(".page-title");
    const friendsSection = friendsListContainer?.closest(".flex-1");
    
    let users:
      | Array<{ id: number; username: string; avatar_url: string; last_seen?: string }>
      | undefined;

    // Update page title based on whose profile we're viewing
    if (pageTitle) {
      pageTitle.textContent = isOwnProfile ? "My Profile" : "User Profile";
    }

    // Hide edit button and friends section when viewing another user's profile
    // Show chat button only when viewing someone else's profile
    if (!isOwnProfile) {
      if (editBtn) editBtn.style.display = "none";
      if (chatBtn) chatBtn.style.display = "inline-block";
      if (friendsSection) (friendsSection as HTMLElement).style.display = "none";
    } else {
      if (editBtn) editBtn.style.display = "inline-block";
      if (chatBtn) chatBtn.style.display = "none";
      if (friendsSection) (friendsSection as HTMLElement).style.display = "block";
    }

    findFriendsBtn?.addEventListener("click", () => this.router.navigate("/users"));

    backBtn?.addEventListener("click", () => this.router.navigate(isOwnProfile ? "/" : "/users"));
    editBtn?.addEventListener("click", () => this.router.navigate("/edit"));

    // Chat button event listener - only for other users' profiles
    chatBtn?.addEventListener("click", () => {
      if (!isOwnProfile && viewingUserId && currentUserId) {
        const chatId = [Number(currentUserId), Number(viewingUserId)]
          .sort((a, b) => a - b)
          .join("-");
        const username = userName?.textContent || "Unknown";
        this.router.navigate(`/chat?chatId=${chatId}&username=${username}`);
      }
    });

    const targetUserId = isOwnProfile ? currentUserId : viewingUserId;

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${targetUserId}`, {
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

    // Only load friends list for own profile
    if (isOwnProfile) {
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
                const avatarContainer = document.createElement("div");
                avatarContainer.classList.add("relative", "min-w-[2rem]", "flex-shrink-0");

                const avatar = document.createElement("img");
                avatar.src = `${config.apiUrl}${avatarUrl}`;
                avatar.alt = `${friend.username}'s avatar`;
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

                const usernameContainer = document.createElement("div");
                usernameContainer.classList.add("flex", "flex-col", "flex-1", "min-w-0");

                const usernameRow = document.createElement("div");
                usernameRow.classList.add("flex", "items-center", "gap-2");

                const username = document.createElement("span");
                username.textContent = friend.username;
                username.classList.add("text-xs", "sm:text-sm", "font-medium", "truncate");

                usernameRow.appendChild(username);

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

                // Create chat button
                const chatButton = document.createElement("button");
                chatButton.innerHTML = "Chat";
                chatButton.title = "Start Chat";
                chatButton.classList.add(
                  "btn-green",
                  "text-xs",
                  "sm:text-sm",
                  "px-2",
                  "sm:px-4",
                  "py-1",
                  "sm:py-2",
                  "flex-shrink-0"
                );
                
                chatButton.addEventListener("click", (e) => {
                  e.stopPropagation(); // Prevent triggering the profile navigation
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

                userItem.appendChild(avatarContainer);
                userItem.appendChild(usernameContainer);
                if (!isPending) {
                  userItem.appendChild(chatButton);
                }
                friendsListContainer.appendChild(userItem);

                // Make the entire user item clickable to view profile
                userItem.addEventListener("click", () => {
                  this.router.navigate(`/profile?userId=${friend.user_id}`);
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
}
