import ConnectionSession from "./ConnectionSession.js";
import { GameManager } from "../gameManager.js";
import { createGame } from "../gameUtils.js";

export default class RemoteConnection extends ConnectionSession {
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
    console.log(`📨 RemoteConnection received message:`, data.type);
    try {
      switch (data.type) {
        case "newGame":
          if (this.fetchGame()) break;
          this.stopGame();
          this.joinGame();
          console.log(`✅ Game joined/created for userId: ${this.userId}`);
          break;
        case "nextGame":
          this.stopGame();
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("❌ RemoteConnection handleMessage error:", err);
      throw err;
    }
  }

  protected onClose() {
    if (this.game) {
      this.game.disconnect(this.connection);
    }
  }

  protected stopGame(): void {
    try {
      if (this.game && this.game.isConnected(this.connection)) {
        this.game.stop();
        this.gameManager.removeActiveGame(this.game);
        this.game.clients.forEach((client) => {
          this.gameManager.removeUserGame(client.playerInfo.userId);
        });
        if (this.gameManager.isWaitingRemote(this.userId)) {
          this.gameManager.setWaitingRemote(null);
        }
        this.game = null;
      }
    } catch (err) {
      console.error("Error stopping game:", err);
    }
  }

  private fetchGame(): boolean {
    this.game = this.gameManager.getUserGame(this.userId);
    return this.game !== null && this.game.updateConnection(this.userId, this.connection);
  }

  protected joinGame() {
    try {
      console.log(`🎮 joinGame called for userId: ${this.userId}`);
      const waitingRemotePlayer = this.gameManager.getWaitingRemote();

      // Check if there's a waiting player and it's not the same user
      if (waitingRemotePlayer && waitingRemotePlayer.playerInfo.userId !== this.userId) {
        console.log(
          `🤝 Found waiting player (userId: ${waitingRemotePlayer.playerInfo.userId}), pairing them`
        );
        this.game = waitingRemotePlayer.game;
        this.gameManager.setWaitingRemote(null);
        this.game.connect(2, { userId: this.userId, username: this.username }, this.connection);
        this.gameManager.addUserGame(this.userId, this.game);
        this.game
          .runGameCountdown()
          .catch((err) => console.error("Error during online game countdown:", err));
        console.log(`✅ Game started with opponent`);
      } else {
        if (waitingRemotePlayer) {
          console.log(`⚠️ Waiting player is same user (${this.userId}), creating new game instead`);
        } else {
          console.log(`➕ No waiting player, creating new game`);
        }
        this.game = createGame(this.mode, (game) => {
          this.gameManager.removeActiveGame(game);
          game.clients.forEach((client) => {
            this.gameManager.removeUserGame(client.playerInfo.userId);
          });
        });
        this.game.connect(1, { userId: this.userId, username: this.username }, this.connection);
        this.game.freezeBall();
        this.gameManager.addActiveGame(this.game);
        this.gameManager.addUserGame(this.userId, this.game);
        this.gameManager.setWaitingRemote({
          playerInfo: { userId: this.userId, username: this.username },
          connection: this.connection,
          game: this.game,
        });
        console.log(`✅ Game created and waiting for opponent`);
      }
    } catch (err) {
      console.error("❌ joinGame error:", err);
      throw err;
    }
  }
}
