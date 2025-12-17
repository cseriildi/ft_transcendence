import ConnectionSession from "./ConnectionSession.js";
import { Tournament } from "../Tournament.js";
import { GameManager } from "../gameManager.js";
import { sendErrorToClient } from "../networkUtils.js";
import { createGame } from "../gameUtils.js";
import { RemoteTournament } from "../RemoteTournament.js";

export default class RemoteTournamentConnection extends ConnectionSession {
  private tournament: RemoteTournament | null = null;
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

  protected async handleMessage(data: any) {
    switch (data.type) {
      case "newGame":
        if (this.fetchTournament()) break;
        this.joinTournament();
        if (this.tournament) {
          this.game = this.tournament.fetchGame(this.userId);
        }
      case "nextGame":
        if (!this.tournament) return;
        this.game = this.tournament.fetchGame(this.userId);
        break;
      default:
        break;
    }
  }

  public onClose() {
    if (this.game) {
      this.game.disconnect(this.connection);
    }
    if (this.tournament) {
      this.tournament.updatePlayerConnection(this.userId, null);
    }
  }

  private fetchTournament(): boolean {
    this.tournament = this.gameManager.getTournamentPlayer(this.userId);
    return (
      this.tournament !== null &&
      this.tournament.updatePlayerConnection(this.userId, this.connection)
    );
  }

  private joinTournament() {
    if (this.tournament) return;
    this.tournament = this.gameManager.getWaitingTournament();
    if (!this.tournament) {
      this.tournament = new RemoteTournament(this.gameManager);
    }
    this.tournament.addPlayer(
      {
        username: this.username,
        userId: this.userId,
        score: 0,
      },
      this.connection
    );
  }
}
