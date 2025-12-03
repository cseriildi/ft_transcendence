import { createGame } from "../gameUtils.js";
import ConnectionSession from "./ConnectionSession.js";
import { GameManager } from "../gameManager.js";

export default class LocalConnection extends ConnectionSession {
  constructor(connection: any, req: any, mode: string, gameManager: GameManager) {
    super(connection, req, mode, gameManager);
  }

  protected async handleMessage(data: any) {
    switch (data.type) {
      case "newGame":
        this.stopGame();
        this.game = createGame(this.mode, (game) => {
          this.gameManager.removeActiveGame(game);
        });
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

  protected onClose() {
    this.stopGame();
  }
}
