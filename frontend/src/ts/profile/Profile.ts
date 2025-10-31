import { Router } from "../router/Router.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
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
		let users: Array<{ id: number; username: string; avatar_url: string }> | undefined;

		findFriendsBtn?.addEventListener("click", () => this.router.navigate("/users"));

		backBtn?.addEventListener("click", () => this.router.navigate("/"));
		editBtn?.addEventListener("click", () => this.router.navigate("/edit"));

		try {
			const response = await fetchWithRefresh(`http://localhost:3000/api/users/${getUserId()}`, {
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
					userAvatar.src = `http://localhost:3000${data.data.avatar_url}`;
				}
			} else {
				console.error("Failed to fetch user data", await response.json());
			}
		} catch (error) {
				console.error("Error fetching user data", error);
		}

		try {
			const usersResponse = await fetchWithRefresh(`http://localhost:3000/api/users`, {
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
			const response = await fetch("http://localhost:3000/api/friends/status", {
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
						data.data.friends.forEach((friend: { user_id: number; username: string; status: string; is_inviter: boolean }) => {
							// Find the avatar URL from the users list
							const userWithAvatar = users?.find((u: any) => u.id === friend.user_id);
							const avatarUrl = userWithAvatar?.avatar_url || '/uploads/avatars/default/default-avatar.png';

							const isPending = friend.status === "pending";
							const isInviter = friend.is_inviter;

							const userItem = document.createElement("div");
							userItem.classList.add(
								"user-item", "flex", "items-center", "space-x-4",
								"p-2", "hover:bg-neon-pink", "cursor-pointer", "w-64",
								"rounded-lg", "text-white"
							);

							const avatar = document.createElement("img");
							avatar.src = `http://localhost:3000${avatarUrl}`;
							avatar.alt = `${friend.username}'s avatar`;
							avatar.classList.add("w-8", "h-8", "rounded-full", "min-w-[2rem]");
							
							// Add opacity if pending
							if (isPending) {
								avatar.classList.add("opacity-50");
							}

							const usernameContainer = document.createElement("div");
							usernameContainer.classList.add("flex", "flex-col", "flex-1", "min-w-0");

							const username = document.createElement("span");
							username.textContent = friend.username;
							username.classList.add("text-sm", "font-medium", "truncate");

							usernameContainer.appendChild(username);

							// Add pending indicator
							if (isPending) {
								const statusLabel = document.createElement("span");
								statusLabel.textContent = isInviter ? "(Request sent)" : "(Pending approval)";
								statusLabel.classList.add("text-xs", "text-gray-400", "italic");
								usernameContainer.appendChild(statusLabel);
							}

							userItem.appendChild(avatar);
							userItem.appendChild(usernameContainer);
							friendsListContainer.appendChild(userItem);

							// Only allow chat for accepted friends
							if (!isPending) {
								userItem.addEventListener("click", () => {
									const currentUserId = getUserId();
									const friendId = friend.user_id;
									const chatId = [currentUserId, friendId].sort((a, b) => a - b).join("-");
									this.router.navigate(`/chat?chatId=${chatId}&username=${friend.username}`);
								});
							} else {
								// Change cursor for pending requests
								userItem.classList.remove("cursor-pointer");
								userItem.classList.add("cursor-not-allowed", "opacity-75");
							}
						});
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