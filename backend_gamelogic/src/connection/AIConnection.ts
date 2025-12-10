import { GameManager } from "../gameManager.js";
import { createGame } from "../gameUtils.js";
import ConnectionSession from "./ConnectionSession.js";
import { sendErrorToClient } from "../networkUtils.js";

export default class AIConnection extends ConnectionSession {
  constructor(connection: any, req: any, mode: string, gameManager: GameManager) {
    super(connection, req, mode, gameManager);
  }

  protected async handleMessage(data: any) {
    switch (data.type) {
      case "newGame":
        if (!data.difficulty || !["easy", "medium", "hard"].includes(data.difficulty)) {
          sendErrorToClient(this.connection, "Invalid AI difficulty");
          return;
        }
        this.stopGame();
        this.game = createGame(this.mode, (game) => {
          this.gameManager.removeActiveGame(game);
        });
        this.game.aiPlayer.aiDifficulty = data.difficulty;
        this.game.clients.set(2, {
          playerInfo: { userId: 0, username: this.mode },
          connection: this.connection,
        });
        this.gameManager.addActiveGame(this.game);
        this.game.freezeBall();
        this.game.runGameCountdown();
        break;
      case "nextGame":
        this.stopGame();
        break;
      default:
        break;
    }
  }

  public onClose() {
    this.stopGame();
  }
}
