import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { getAccessToken, isUserAuthorized, getUserId } from "../utils/utils.js";
import { config } from "../config.js";

export class Users {
    constructor(private router: any) {}
    async initPage(): Promise<void> {
        if (!isUserAuthorized()) {
            this.router.navigate("/");
            return;
        }

        const backBtn = document.getElementById("back-btn");
        let friends: { data?: { friends?: Array<{ user_id: number; status: string; is_inviter: boolean }> } } | undefined;

        backBtn?.addEventListener("click", () => this.router.navigate("/profile"));

        try {
            const response = await fetchWithRefresh(`${config.apiUrl}/api/friends/status", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getAccessToken()}`,
                },
                credentials: "include",
            });

            if (response.ok) {
                friends = await response.json();
            } else {
                console.error("Failed to fetch friends status", await response.json());
            }
        } catch (error) {
            console.error("Error fetching friends status", error);
        }

        try {
            const response = await fetch(`${config.apiUrl}/api/users", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                const users = data.data;
                const usersListContainer = document.getElementById("user-list");

                if (usersListContainer) {
                    usersListContainer.innerHTML = "";

                    if (users.length === 1) {
                        usersListContainer.innerHTML = "<p>No other users found.</p>";
                        usersListContainer.classList.add("text-white");
                        return;
                    }

                    users.forEach((user: { username: string; avatar_url: string; id: number }) => {
                        if (user.id === Number(sessionStorage.getItem("userId"))) {
                            return;
                        }

                        // Check friendship status
                        const friendStatus = friends?.data?.friends?.find(
                            (friend: any) => friend.user_id === user.id
                        );
                        
                        const isFriend = friendStatus?.status === "accepted";
                        const isPending = friendStatus?.status === "pending";
                        const isInviter = friendStatus?.is_inviter === true;

                        const userItem = document.createElement("div");
                        userItem.classList.add("flex", "items-center", "justify-between", "mb-4", "p-2", "rounded-lg", "hover:bg-gray-800");

                        const userInfo = document.createElement("div");
                        userInfo.classList.add("flex", "items-center");

                        const avatar = document.createElement("img");
                        avatar.src = `http://localhost:3000${user.avatar_url}`;
                        avatar.alt = `${user.username}'s avatar`;
                        avatar.classList.add("w-12", "h-12", "rounded-full", "mr-4");

                        const username = document.createElement("span");
                        username.textContent = user.username;
                        username.classList.add("text-white", "mr-4", "max-w-[150px]", "truncate", "block");

                        userInfo.appendChild(avatar);
                        userInfo.appendChild(username);

                        // Add click handler to open chat with any user
                        userInfo.classList.add("cursor-pointer");
                        userInfo.addEventListener("click", () => {
                            const currentUserId = getUserId();
                            const friendId = user.id;
                            const chatId = [currentUserId, friendId].sort((a, b) => Number(a) - Number(b)).join("-");
                            this.router.navigate(`/chat?chatId=${chatId}&username=${user.username}`);
                        });

                        // Create action button(s) based on status
                        const buttonContainer = document.createElement("div");
                        buttonContainer.classList.add("flex", "gap-2");

                        if (isFriend) {
                            // Show Delete Friend button
                            const deleteButton = document.createElement("button");
                            deleteButton.textContent = "Delete Friend";
                            deleteButton.classList.add(
                                "bg-red-600", "hover:bg-red-700", "text-white", 
                                "font-bold", "py-1", "px-3", "rounded", "transition"
                            );
                            deleteButton.addEventListener("click", async () => {
                                try {
                                    const response = await fetchWithRefresh(`http://localhost:3000/api/friends/${user.id}`, {
                                        method: "DELETE",
                                        headers: {
                                            Authorization: `Bearer ${getAccessToken()}`,
                                        },
                                        credentials: "include",
                                    });

                                    if (response.ok) {
                                        this.initPage();
                                    } else {
                                        console.error("Failed to delete friend", await response.json());
                                    }
                                } catch (error) {
                                    console.error("Error deleting friend", error);
                                }
                            });
                            buttonContainer.appendChild(deleteButton);
                        } else if (isPending && isInviter) {
                            // User sent the request - show Cancel button
                            const cancelButton = document.createElement("button");
                            cancelButton.textContent = "Cancel Request";
                            cancelButton.classList.add(
                                "bg-gray-600", "hover:bg-gray-700", "text-white", 
                                "font-bold", "py-1", "px-3", "rounded", "transition"
                            );
                            cancelButton.addEventListener("click", async () => {
                                try {
                                    const response = await fetchWithRefresh(`http://localhost:3000/api/friends/${user.id}`, {
                                        method: "DELETE",
                                        headers: {
                                            Authorization: `Bearer ${getAccessToken()}`,
                                        },
                                        credentials: "include",
                                    });

                                    if (response.ok) {
                                        this.initPage();
                                    } else {
                                        console.error("Failed to cancel request", await response.json());
                                    }
                                } catch (error) {
                                    console.error("Error canceling request", error);
                                }
                            });
                            buttonContainer.appendChild(cancelButton);
                        } else if (isPending && !isInviter) {
                            // User received the request - show Accept/Decline buttons
                            const acceptButton = document.createElement("button");
                            acceptButton.textContent = "Accept";
                            acceptButton.classList.add(
                                "bg-neon-green", "hover:bg-green-600", "text-purple-900", 
                                "font-bold", "py-1", "px-3", "rounded", "transition"
                            );
                            acceptButton.addEventListener("click", async () => {
                                try {
                                    const response = await fetchWithRefresh(`http://localhost:3000/api/friends/${user.id}/accept`, {
                                        method: "PATCH",
                                        headers: {
                                            Authorization: `Bearer ${getAccessToken()}`,
                                        },
                                        credentials: "include",
                                    });

                                    if (response.ok) {
                                        this.initPage();
                                    } else {
                                        console.error("Failed to accept request", await response.json());
                                    }
                                } catch (error) {
                                    console.error("Error accepting request", error);
                                }
                            });

                            const declineButton = document.createElement("button");
                            declineButton.textContent = "Decline";
                            declineButton.classList.add(
                                "bg-red-600", "hover:bg-red-700", "text-white", 
                                "font-bold", "py-1", "px-3", "rounded", "transition"
                            );
                            declineButton.addEventListener("click", async () => {
                                try {
                                    const response = await fetchWithRefresh(`http://localhost:3000/api/friends/${user.id}/decline`, {
                                        method: "DELETE",
                                        headers: {
                                            Authorization: `Bearer ${getAccessToken()}`,
                                        },
                                        credentials: "include",
                                    });

                                    if (response.ok) {
                                        this.initPage();
                                    } else {
                                        console.error("Failed to decline request", await response.json());
                                    }
                                } catch (error) {
                                    console.error("Error declining request", error);
                                }
                            });

                            buttonContainer.appendChild(acceptButton);
                            buttonContainer.appendChild(declineButton);
                        } else {
                            // No relationship - show Add Friend button
                            const addButton = document.createElement("button");
                            addButton.textContent = "Add Friend";
                            addButton.classList.add(
                                "bg-neon-green", "hover:bg-neon-pink", "text-purple-900", 
                                "font-bold", "py-1", "px-3", "rounded", "transition"
                            );
                            addButton.addEventListener("click", async () => {
                                try {
                                    const response = await fetchWithRefresh(`http://localhost:3000/api/friends/${user.id}`, {
                                        method: "POST",
                                        headers: {
                                            Authorization: `Bearer ${getAccessToken()}`,
                                        },
                                        credentials: "include",
                                    });

                                    if (response.ok) {
                                        this.initPage();
                                    } else {
                                        console.error("Failed to add friend", await response.json());
                                    }
                                } catch (error) {
                                    console.error("Error adding friend", error);
                                }
                            });
                            buttonContainer.appendChild(addButton);
                        }

                        userItem.appendChild(userInfo);
                        userItem.appendChild(buttonContainer);

                        usersListContainer.appendChild(userItem);
                    });
                }
            } else {
                console.error("Failed to fetch users", await response.json());
            }
        } catch (error) {
            console.error("Error fetching users", error);
        }
    }
}