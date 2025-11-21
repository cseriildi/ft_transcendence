/**
 * Handles profile statistics display and calculation
 */
export class ProfileStats {
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

  public updateStatsOverview(
    wins: number,
    losses: number,
    winPercentage: number,
    lossPercentage: number
  ): void {
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
      winRateElement.className = `font-bold ${
        winPercentage >= 50 ? "text-neon-green" : "text-neon-pink"
      }`;
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

  public reset(): void {
    this.resetStatsOverview();
  }

  public calculateStats(
    matches: any[],
    userId: number
  ): {
    wins: number;
    losses: number;
    winPercentage: number;
    lossPercentage: number;
  } {
    if (!matches || matches.length === 0) {
      return { wins: 0, losses: 0, winPercentage: 0, lossPercentage: 0 };
    }

    const wins = matches.filter((match: any) => match.winner_id === userId).length;
    const losses = matches.length - wins;
    const winPercentage = Math.round((wins / matches.length) * 100);
    const lossPercentage = 100 - winPercentage;

    return { wins, losses, winPercentage, lossPercentage };
  }
}
