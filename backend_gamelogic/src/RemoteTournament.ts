import { TournamentPlayer, GamePairing, Tournament } from "./Tournament";

export class RemoteTournament extends Tournament {
  private createdAt: Date;
  constructor() {
    super([]);
    this.createdAt = new Date();
  }
  addPlayer(player: TournamentPlayer): void {
    this["activePlayers"].add(player);
  }

  removePlayer(player: TournamentPlayer): void {
    this["activePlayers"].delete(player);
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }
}
