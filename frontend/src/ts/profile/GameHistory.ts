import { config } from "../config.js";
import { getAccessToken } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { UserCache } from "./UserCache.js";
import { i18n } from "../utils/i18n.js";
import { ProfileStats } from "./ProfileStats.js";

/**
 * Handles game history display
 */
export class GameHistory {
  private allMatches: any[] = [];
  private displayedMatchesCount: number = 0;
  private readonly MATCHES_PER_PAGE = 5;
  private userCache: UserCache;
  private profileStats: ProfileStats;

  constructor(userCache: UserCache, profileStats: ProfileStats) {
    this.userCache = userCache;
    this.profileStats = profileStats;
  }

  public async loadGameHistory(
    userId: string | number | null,
    container: HTMLElement | null
  ): Promise<void> {
    if (!container || !userId) {
      return;
    }

    // Validate userId is a valid number
    const numericUserId = Number(userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      console.error("Invalid user ID provided to loadGameHistory:", userId);
      container.innerHTML = `<p class='text-red-400 text-center'>${i18n.t("profile.invalidUserId")}</p>`;
      this.profileStats.reset();
      return;
    }

    // Reset instance properties to avoid stale data when viewing different profiles
    this.allMatches = [];
    this.displayedMatchesCount = 0;

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
          container.innerHTML = `<p class='text-white text-center'>${i18n.t("profile.noGamesPlayed")}</p>`;
          this.profileStats.reset();
          return;
        }

        // Calculate and update stats
        const stats = this.profileStats.calculateStats(this.allMatches, numericUserId);
        this.profileStats.updateStatsOverview(
          stats.wins,
          stats.losses,
          stats.winPercentage,
          stats.lossPercentage
        );

        // Reset displayed count and show initial matches
        this.displayedMatchesCount = 0;
        await this.showMoreMatches(userId, container);
      } else {
        console.error("Failed to fetch match history", await response.json());
        container.innerHTML = `<p class='text-red-400 text-center'>${i18n.t("profile.failedLoadHistory")}</p>`;
      }
    } catch (error) {
      console.error("Error fetching match history", error);
      container.innerHTML = `<p class='text-red-400 text-center'>${i18n.t("profile.errorLoadHistory")}</p>`;
    }
  }

  private async showMoreMatches(userId: string | number, container: HTMLElement): Promise<void> {
    // Validate userId is a valid number
    const numericUserId = Number(userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      console.error("Invalid user ID provided to showMoreMatches:", userId);
      return;
    }

    const startIndex = this.displayedMatchesCount;
    const endIndex = Math.min(startIndex + this.MATCHES_PER_PAGE, this.allMatches.length);

    // Remove existing "see more" button if it exists
    const existingSeeMoreBtn = container.querySelector("#see-more-btn");
    if (existingSeeMoreBtn) {
      existingSeeMoreBtn.remove();
    }

    // Collect all unique opponent IDs for this batch of matches
    const matchesToDisplay = this.allMatches.slice(startIndex, endIndex);
    const uniqueOpponentIds = new Set<number>();

    matchesToDisplay.forEach((match) => {
      const isWinner = match.winner_id === numericUserId;
      const opponentId = isWinner ? match.loser_id : match.winner_id;
      uniqueOpponentIds.add(opponentId);
    });

    // Fetch all opponent names in parallel for IDs not in cache
    const uncachedIds = Array.from(uniqueOpponentIds).filter((id) => !this.userCache.has(id));
    if (uncachedIds.length > 0) {
      await Promise.all(uncachedIds.map((id) => this.userCache.getUserName(id)));
    }

    // Add new matches (now all opponent names are cached)
    for (let i = startIndex; i < endIndex; i++) {
      const match = this.allMatches[i];
      const matchElement = this.createMatchElement(match, numericUserId);
      container.appendChild(matchElement);
    }

    this.displayedMatchesCount = endIndex;

    // Add "see more" button if there are more matches to show
    if (this.displayedMatchesCount < this.allMatches.length) {
      const seeMoreBtn = this.createSeeMoreButton(userId, container);
      container.appendChild(seeMoreBtn);
    }
  }

  private createMatchElement(match: any, userId: number): HTMLDivElement {
    const matchElement = document.createElement("div");
    const isWinner = match.winner_id === userId;
    const playerScore = isWinner ? match.winner_score : match.loser_score;
    const opponentScore = isWinner ? match.loser_score : match.winner_score;
    const opponentId = isWinner ? match.loser_id : match.winner_id;

    // Apply different styling based on win/loss
    if (isWinner) {
      matchElement.classList.add("glass-card", "border-neon-green", "p-4", "mb-3");
    } else {
      matchElement.classList.add("glass-card", "p-4", "mb-3");
    }

    const resultColor = isWinner ? "text-neon-green" : "text-neon-pink";
    const resultText = isWinner ? i18n.t("profile.win") : i18n.t("profile.loss");
    const matchDate = new Date(match.played_at).toLocaleDateString();
    const cachedUser = this.userCache.get(opponentId);
    const opponentName = cachedUser?.username || `User ${opponentId}`;

    // Create match structure
    const matchContainer = document.createElement("div");
    matchContainer.classList.add("flex", "justify-between", "items-center");

    // Left side container
    const leftContainer = document.createElement("div");
    leftContainer.classList.add("flex-1");

    // Result and opponent row
    const resultRow = document.createElement("div");
    resultRow.classList.add("flex", "items-center", "gap-3");

    const resultSpan = document.createElement("span");
    resultSpan.className = `${resultColor} font-bold text-sm`;
    resultSpan.textContent = resultText;

    const opponentSpan = document.createElement("span");
    opponentSpan.classList.add("text-white");
    opponentSpan.textContent = `${i18n.t("common.vs")} ${opponentName}`;

    resultRow.appendChild(resultSpan);
    resultRow.appendChild(opponentSpan);

    // Date row
    const dateDiv = document.createElement("div");
    dateDiv.classList.add("text-gray-400", "text-xs", "mt-1");
    dateDiv.textContent = matchDate;

    leftContainer.appendChild(resultRow);
    leftContainer.appendChild(dateDiv);

    // Right side - score
    const scoreDiv = document.createElement("div");
    scoreDiv.classList.add("text-white", "font-bold");
    scoreDiv.textContent = `${playerScore} - ${opponentScore}`;

    matchContainer.appendChild(leftContainer);
    matchContainer.appendChild(scoreDiv);
    matchElement.appendChild(matchContainer);

    return matchElement;
  }

  private createSeeMoreButton(userId: string | number, container: HTMLElement): HTMLButtonElement {
    const seeMoreBtn = document.createElement("button");
    seeMoreBtn.id = "see-more-btn";
    seeMoreBtn.classList.add("btn-green", "text-sm", "sm:text-base", "w-full", "mt-4");
    const remaining = this.allMatches.length - this.displayedMatchesCount;
    seeMoreBtn.textContent = `${i18n.t("profile.seeMore")} (${remaining} ${i18n.t("profile.remaining")})`;

    seeMoreBtn.addEventListener("click", async () => {
      await this.showMoreMatches(userId, container);
    });

    return seeMoreBtn;
  }
}
