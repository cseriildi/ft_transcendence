export interface TournamentPlayer {
  username: string;
  userId: string | number;
  score: number;
}

export interface GamePairing {
  player1: TournamentPlayer;
  player2: TournamentPlayer;
  round: number;
}

export class Tournament {
  private activePlayers: Set<TournamentPlayer> = new Set();
  private currentRound: Set<GamePairing> = new Set();
  private results: Array<GamePairing> = [];
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
      this.activePlayers.add({
        username: username,
        userId: username,
        score: 0,
      });
    });
  }

  getRandomPlayer(): TournamentPlayer | null {
    if (this.activePlayers.size === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * this.activePlayers.size);
    const player = Array.from(this.activePlayers)[randomIndex];
    this.activePlayers.delete(player);
    return player;
  }

  getNextPair(): GamePairing | null {
    if (this.currentRound.size === 0) {
      if (this.activePlayers.size < 2) {
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

    while (this.activePlayers.size >= 2) {
      const pairing: GamePairing = {
        player1: this.getRandomPlayer()!,
        player2: this.getRandomPlayer()!,
        round: this.round,
      };

      this.currentRound.add(pairing);
    }
  }

  storeGameResult(gamePairing: GamePairing): void {
    const winner =
      gamePairing.player1.score > gamePairing.player2.score
        ? gamePairing.player1
        : gamePairing.player2;

    this.results.push(gamePairing);
    winner.score = 0;
    this.activePlayers.add(winner);
  }

  advanceWinner(player: TournamentPlayer): void {
    player.score = 0;
    this.activePlayers.add(player);
  }

  getResults(): Array<GamePairing> {
    return this.results;
  }

  getRound(): number {
    return this.round;
  }
}
