import { Router } from "../router/Router.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
import { config } from "../config.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

export class Profile {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  private resetStatsOverview(): void {
    const totalGamesElement = document.getElementById("total-games");
    const totalWinsElement = document.getElementById("total-wins");
    const totalLossesElement = document.getElementById("total-losses");
    const winPercentageLabel = document.getElementById("win-percentage-label");
    const lossPercentageLabel = document.getElementById("loss-percentage-label");
    const winBar = document.getElementById("win-bar");
    const lossBar = document.getElementById("loss-bar");
    const winRateElement = document.getElementById("win-rate");
    const statsCard = document.getElementById("stats-card");
    
    if (totalGamesElement) totalGamesElement.textContent = "0";
    if (totalWinsElement) totalWinsElement.textContent = "0";
    if (totalLossesElement) totalLossesElement.textContent = "0";
    if (winPercentageLabel) winPercentageLabel.textContent = "Wins 0%";
    if (lossPercentageLabel) lossPercentageLabel.textContent = "Losses 0%";
    if (winBar) winBar.style.width = "0%";
    if (lossBar) lossBar.style.width = "0%";
    if (winRateElement) {
      winRateElement.textContent = "0%";
      winRateElement.className = "font-bold text-white";
    }
    if (statsCard) {
      statsCard.classList.remove("border-neon-green");
    }
  }

  private updateStatsOverview(wins: number, losses: number, winPercentage: number, lossPercentage: number): void {
    const totalGames = wins + losses;
    
    // Update the numbers
    const totalGamesElement = document.getElementById("total-games");
    const totalWinsElement = document.getElementById("total-wins");
    const totalLossesElement = document.getElementById("total-losses");
    
    if (totalGamesElement) totalGamesElement.textContent = totalGames.toString();
    if (totalWinsElement) totalWinsElement.textContent = wins.toString();
    if (totalLossesElement) totalLossesElement.textContent = losses.toString();
    
    // Update percentage labels
    const winPercentageLabel = document.getElementById("win-percentage-label");
    const lossPercentageLabel = document.getElementById("loss-percentage-label");
    
    if (winPercentageLabel) winPercentageLabel.textContent = `Wins ${winPercentage}%`;
    if (lossPercentageLabel) lossPercentageLabel.textContent = `Losses ${lossPercentage}%`;
    
    // Update progress bars
    const winBar = document.getElementById("win-bar");
    const lossBar = document.getElementById("loss-bar");
    
    if (winBar) winBar.style.width = `${winPercentage}%`;
    if (lossBar) lossBar.style.width = `${lossPercentage}%`;
    
    // Update win rate with color
    const winRateElement = document.getElementById("win-rate");
    if (winRateElement) {
      winRateElement.textContent = `${winPercentage}%`;
      winRateElement.className = `font-bold ${winPercentage >= 50 ? 'text-neon-green' : 'text-neon-pink'}`;
    }
    
    // Update stats card border based on win percentage
    const statsCard = document.getElementById("stats-card");
    if (statsCard) {
      if (winPercentage >= 50) {
        statsCard.classList.add("border-neon-green");
      } else {
        statsCard.classList.remove("border-neon-green");
      }
    }
  }

  private userCache: Map<number, string> = new Map();

  private async getUserName(userId: number): Promise<string> {
    // Check cache first
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const userData = await response.json();
        const userName = userData.data?.username || `User ${userId}`;
        this.userCache.set(userId, userName);
        return userName;
      } else {
        console.error(`Failed to fetch user ${userId}`, await response.json());
        return `User ${userId}`;
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}`, error);
      return `User ${userId}`;
    }
  }

  private allMatches: any[] = [];
  private displayedMatchesCount: number = 0;
  private readonly MATCHES_PER_PAGE = 5;

  private async loadGameHistory(userId: string | number | null, container: HTMLElement | null, statsContainer: HTMLElement | null): Promise<void> {
    if (!container || !userId) {
      return;
    }

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/matches/${userId}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.allMatches = data.data || [];

        container.innerHTML = "";

        if (this.allMatches.length === 0) {
          container.innerHTML = "<p class='text-white text-center'>No games played yet</p>";
          this.resetStatsOverview();
          return;
        }

        // Calculate win/loss statistics based on all matches
        const wins = this.allMatches.filter((match: any) => match.winner_id === Number(userId)).length;
        const losses = this.allMatches.length - wins;
        const winPercentage = Math.round((wins / this.allMatches.length) * 100);
        const lossPercentage = 100 - winPercentage;

        // Update stats overview
        this.updateStatsOverview(wins, losses, winPercentage, lossPercentage);

        // Reset displayed count and show initial matches
        this.displayedMatchesCount = 0;
        await this.showMoreMatches(userId, container);

      } else {
        console.error("Failed to fetch match history", await response.json());
        container.innerHTML = "<p class='text-red-400 text-center'>Failed to load game history</p>";
      }
    } catch (error) {
      console.error("Error fetching match history", error);
      container.innerHTML = "<p class='text-red-400 text-center'>Error loading game history</p>";
    }
  }

  private async showMoreMatches(userId: string | number, container: HTMLElement): Promise<void> {
    const startIndex = this.displayedMatchesCount;
    const endIndex = Math.min(startIndex + this.MATCHES_PER_PAGE, this.allMatches.length);
    
    // Remove existing "see more" button if it exists
    const existingSeeMoreBtn = container.querySelector('#see-more-btn');
    if (existingSeeMoreBtn) {
      existingSeeMoreBtn.remove();
    }

    // Add new matches
    for (let i = startIndex; i < endIndex; i++) {
      const match = this.allMatches[i];
      const matchElement = document.createElement("div");
      
      const isWinner = match.winner_id === Number(userId);
      const playerScore = isWinner ? match.winner_score : match.loser_score;
      const opponentScore = isWinner ? match.loser_score : match.winner_score;
      const opponentId = isWinner ? match.loser_id : match.winner_id;

      // Apply different styling based on win/loss
      if (isWinner) {
        // WIN card: glass-card with neon-green border
        matchElement.classList.add(
          "glass-card",
          "border-neon-green",
          "p-4",
          "mb-3"
        );
      } else {
        // LOSS card: just glass-card
        matchElement.classList.add(
          "glass-card",
          "p-4",
          "mb-3"
        );
      }
      
      const resultColor = isWinner ? "text-neon-green" : "text-neon-pink";
      const resultText = isWinner ? "WIN" : "LOSS";

      const matchDate = new Date(match.played_at).toLocaleDateString();

      // Get opponent name
      const opponentName = await this.getUserName(opponentId);

      matchElement.innerHTML = `
        <div class="flex justify-between items-center">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <span class="${resultColor} font-bold text-sm">${resultText}</span>
              <span class="text-white">vs ${opponentName}</span>
            </div>
            <div class="text-gray-400 text-xs mt-1">${matchDate}</div>
          </div>
          <div class="text-white font-bold">
            ${playerScore} - ${opponentScore}
          </div>
        </div>
      `;

      container.appendChild(matchElement);
    }

    this.displayedMatchesCount = endIndex;

    // Add "see more" button if there are more matches to show
    if (this.displayedMatchesCount < this.allMatches.length) {
      const seeMoreBtn = document.createElement("button");
      seeMoreBtn.id = "see-more-btn";
      seeMoreBtn.classList.add(
        "btn-green",
        "text-sm",
        "sm:text-base",
        "w-full",
        "mt-4"
      );
      seeMoreBtn.textContent = `See More (${this.allMatches.length - this.displayedMatchesCount} remaining)`;
      
      seeMoreBtn.addEventListener("click", async () => {
        await this.showMoreMatches(userId, container);
      });

      container.appendChild(seeMoreBtn);
    }
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
    const friendsSection = document.getElementById("friends-card");
    const gameHistoryContainer = document.getElementById("game-history");
    const statsOverviewContainer = document.getElementById("stats-overview");
    
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

    backBtn?.addEventListener("click", () => this.router.navigate("/"));
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

    // Load game history for the profile being viewed
    await this.loadGameHistory(targetUserId, gameHistoryContainer, statsOverviewContainer);

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
                  "btn-pink"
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
                userItem.appendChild(chatButton);
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
