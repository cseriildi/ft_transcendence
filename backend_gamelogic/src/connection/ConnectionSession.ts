import { GameServer } from "../gameTypes.js";
import { GameManager } from "../gameManager.js";
import { createGame } from "../gameUtils.js";

export default abstract class ConnectionSession {
  public connection: any;
  public req: any;
  public mode: string;
  public gameManager: GameManager;

  public game: GameServer | null = null;

  constructor(connection: any, req: any, mode: string, gameManager: GameManager) {
    this.connection = connection;
    this.req = req;
    this.mode = mode;
    this.gameManager = gameManager;
    // Note: message and close listeners are set up by the server handler
  }

  protected async onMessage(raw: any) {
    let data: any = null;
    try {
      data = JSON.parse(raw.toString());
    } catch (err) {
      try {
        this.connection.send(JSON.stringify({ type: "error", message: "Failed to parse message" }));
      } catch (e) {}
      return;
    }

    try {
      if (data.type === "playerInput") {
        if (!this.game) return;
        const input = data.data as { player: number; action: string };
        this.game.handlePlayerInput(input);
        return;
      }
      await this.handleMessage(data);
    } catch (err) {
      console.error("ConnectionSession handleMessage error:", err);
      try {
        this.connection.send(JSON.stringify({ type: "error", message: "Server error" }));
      } catch (e) {}
    }
  }

  protected abstract handleMessage(data: any): Promise<void>;
  protected abstract onClose(): void;

  // Public wrapper methods for the server handler
  public async onMessagePublic(raw: any) {
    console.log(`🔵 onMessagePublic called for ${this.mode} mode`);
    try {
      await this.onMessage(raw);
    } catch (err) {
      console.error(`🔴 onMessagePublic error for ${this.mode}:`, err);
      throw err;
    }
  }

  public onClosePublic() {
    console.log(`🔵 onClosePublic called for ${this.mode} mode`);
    try {
      this.onClose();
    } catch (err) {
      console.error(`🔴 onClosePublic error for ${this.mode}:`, err);
    }
    this.game = null;
  }

  protected stopGame() {
    try {
      if (this.game) {
        this.game.stop();
        this.gameManager.removeActiveGame(this.game);
        this.game = null;
      }
    } catch (err) {
      console.error("Error stopping game:", err);
    }
  }

  protected joinGame() {
    this.game = createGame(this.mode, (game) => {
      this.gameManager.removeActiveGame(game);
    });
    this.game.connect(2, { userId: 0, username: "Guest" }, this.connection);
    this.gameManager.addActiveGame(this.game);
    this.game.freezeBall();
    this.game
      .runGameCountdown()
      .catch((err) => console.error("Error during online game countdown:", err));
  }
}
