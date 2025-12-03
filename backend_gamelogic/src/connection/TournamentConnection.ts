import ConnectionSession from "./ConnectionSession.js";
import { Tournament } from "../Tournament.js";
import { GameManager } from "../gameManager.js";
import { sendErrorToClient } from "../networkUtils.js";
import { createGame } from "../gameUtils.js";

export default class TournamentConnection extends ConnectionSession {
  private tournament: Tournament | null = null;
  constructor(connection: any, req: any, mode: string, gameManager: GameManager) {
    super(connection, req, mode, gameManager);
  }

  protected async handleMessage(data: any) {
    switch (data.type) {
      case "newTournament":
        if (!data.players || !Array.isArray(data.players)) {
          sendErrorToClient(this.connection, "Invalid players list");
          return;
        }
        if (this.tournament) {
          this.gameManager.removeTournament(this.tournament);
          this.tournament = null;
        }
        try {
          this.tournament = new Tournament(this.checkNames(data.players));
        } catch (err) {
          sendErrorToClient(this.connection, (err as Error).message);
          return;
        }
        this.gameManager.addTournament(this.tournament);
        this.startGame();
        break;
      case "newGame":
        if (!this.tournament || !this.game || !this.game.isWaiting) return;
        this.game.runGameCountdown();
        break;

      case "nextGame":
        if (!this.tournament) return;
        this.startGame();
        break;
      default:
        break;
    }
  }

  protected onClose() {
    this.stopGame();
    if (this.tournament) {
      this.gameManager.removeTournament(this.tournament);
    }
    this.tournament = null;
  }

  private checkNames(names: string[]): string[] {
    const usernames = names.map((name: string) => name.trim());
    if (usernames.includes("")) throw new Error("Player usernames must be non-empty");

    const uniqueUsernames = new Set(usernames);
    if (uniqueUsernames.size !== usernames.length)
      throw new Error("Player usernames must be unique");

    if (names.length !== 4 && names.length !== 8) {
      throw new Error("Tournament must have exactly 4 or 8 players");
    }
    return usernames;
  }

  private startGame() {
    if (!this.tournament) return;
    const pair = this.tournament.getNextPair();
    if (!pair) {
      console.log("🏆 No more pairs - tournament complete!");
      this.tournament.getResults();
      this.gameManager.removeTournament(this.tournament);
      this.tournament = null;
      return;
    }

    this.game = createGame(this.mode, (game) => {
      this.gameManager.removeActiveGame(game);
    });
    this.game.tournament = this.tournament;
    this.game.clients.set(1, {
      playerInfo: { username: pair.player1.username, userId: pair.player1.userId },
      connection: this.connection,
    });
    this.game.clients.set(2, {
      playerInfo: { username: pair.player2.username, userId: pair.player2.userId },
      connection: undefined,
    });
    this.game.freezeBall();
    this.gameManager.addActiveGame(this.game);
  }
}
