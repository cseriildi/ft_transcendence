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
		const userListContainer = document.getElementById("user-list");
		const userEmail = document.getElementById("user-email");

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
			const response = await fetch("http://localhost:3000/api/friends/status", {
				headers: {
					Authorization: `Bearer ${getAccessToken()}`,
				},
				method: "GET",
				credentials: "include",
			});

			if (response.ok) {
				const data = await response.json();
				if (userListContainer) {
					userListContainer.innerHTML = "";
					if (data.data.length === 0) {
						userListContainer.innerHTML = "<p>You don't have friends yet</p>";
					} else {
						data.data.forEach((user: { username: string; avatar_url: string, id: number }) => {
							const userItem = document.createElement("div");
							userItem.classList.add(
								"user-item", "flex", "items-center", "space-x-4",
								"p-2", "hover:bg-neon-pink", "cursor-pointer", "w-64",
								"rounded-lg", "text-white"
							);

							const avatar = document.createElement("img");
							avatar.src = `http://localhost:3000${user.avatar_url}`;
							avatar.alt = `${user.username}'s avatar`;
							avatar.classList.add("w-8", "h-8", "rounded-full", "min-w-[2rem]");

							const username = document.createElement("span");
							username.textContent = user.username;
							username.classList.add("text-sm", "font-medium", "max-w-xs", "rounded-lg", "truncate");

							userItem.appendChild(avatar);
							userItem.appendChild(username);
							userListContainer.appendChild(userItem);

							userItem.addEventListener("click", () => {
								const currentUserId = getUserId();
								const friendId = user.id;
								const chatId = [currentUserId, friendId].sort((a, b) => a - b).join("-");
								this.router.navigate(`/chat?chatId=${chatId}&username=${user.username}`);
							});
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