import ConnectionSession from "./ConnectionSession.js";
import { Tournament } from "../Tournament.js";
import { GameManager } from "../gameManager.js";
import { sendErrorToClient } from "../networkUtils.js";
import { createGame } from "../gameUtils.js";
import { RemoteTournament } from "../RemoteTournament.js";

export default class RemoteTournamentConnection extends ConnectionSession {
  private userId: number;
  private username: string;

  constructor(
    connection: any,
    req: any,
    mode: string,
    gameManager: GameManager,
    userId: number,
    username: string
  ) {
    super(connection, req, mode, gameManager);
    this.userId = userId;
    this.username = username;
  }

  private get tournament(): RemoteTournament | null {
    return this.gameManager.getTournamentPlayer(this.userId);
  }

  protected async handleMessage(data: any) {
    switch (data.type) {
      case "newGame":
        if (this.reconnectToTournament()) break;
        this.joinTournament();
        if (this.tournament) {
          this.game = this.tournament.fetchGame(this.userId);
        }
        break;
      case "nextGame":
        if (!this.tournament) return;
        this.game = this.tournament.fetchGame(this.userId);
        break;
      default:
        break;
    }
  }

  public onClose() {
    // Only disconnect from tournament - it will handle both tournament and game connections
    if (this.tournament) {
      this.tournament.disconnect(this.connection);
    }
  }

  private reconnectToTournament(): boolean {
    const tournament = this.tournament;
    let updated = false;
    if (tournament) {
      updated = tournament.updatePlayerConnection(this.userId, this.connection);
      this.game = tournament.fetchGame(this.userId);
    }
    return updated;
  }

  private joinTournament() {
    if (this.tournament) return;
    let tournament = this.gameManager.getWaitingTournament();
    if (!tournament) {
      tournament = new RemoteTournament(this.gameManager);
    }
    tournament.addPlayer(
      {
        username: this.username,
        userId: this.userId,
        score: 0,
      },
      this.connection
    );
  }
}
