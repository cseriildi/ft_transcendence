export interface TournamentPlayer {
  username: string;
  userId: number;
  score: number;
}

export interface GamePairing {
  player1: TournamentPlayer;
  player2: TournamentPlayer;
  round: number;
}

export class Tournament {
  protected waitingPlayers: Set<TournamentPlayer> = new Set();
  protected currentRound: Set<GamePairing> = new Set();
  private round: number = 0;

  constructor(playerNames: string[]) {
    // Validate and add participants
    this.initializeParticipants(playerNames);
  }

  private initializeParticipants(playerNames: string[]): void {
    // Trim all names
    const trimmedNames = playerNames.map((name) => name.trim());

    // Check for empty names
    const emptyNames = trimmedNames.filter((username) => username.length === 0);
    if (emptyNames.length > 0) {
      throw new Error("All player names must be non-empty");
    }

    // Check for duplicates
    const uniqueNames = new Set(trimmedNames);
    if (uniqueNames.size !== trimmedNames.length) {
      throw new Error("All player names must be unique");
    }

    // Add validated participants
    trimmedNames.forEach((username) => {
      this.waitingPlayers.add({
        username: username,
        userId: 0,
        score: 0,
      });
    });
  }

  getRandomPlayer(): TournamentPlayer | null {
    if (this.waitingPlayers.size === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * this.waitingPlayers.size);
    const player = Array.from(this.waitingPlayers)[randomIndex];
    this.waitingPlayers.delete(player);
    return player;
  }

  getNextPair(): GamePairing | null {
    if (this.currentRound.size === 0) {
      if (this.waitingPlayers.size < 2) {
        return null;
      }
      this.generatePairings();
    }
    const pair = this.currentRound.values().next().value;
    this.currentRound.delete(pair!);
    return pair!;
  }

  generatePairings(): void {
    this.round++;

    while (this.waitingPlayers.size >= 2) {
      const pairing: GamePairing = {
        player1: this.getRandomPlayer()!,
        player2: this.getRandomPlayer()!,
        round: this.round,
      };

      this.currentRound.add(pairing);
    }
  }

  advanceWinner(player: TournamentPlayer): void {
    player.score = 0;
    this.waitingPlayers.add(player);
  }
}
