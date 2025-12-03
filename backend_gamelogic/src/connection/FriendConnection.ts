import ConnectionSession from "./ConnectionSession.js";
import { GameManager } from "../gameManager.js";
import { createGame } from "../gameUtils.js";
import { config } from "../config.js";
import { sendErrorToClient } from "../networkUtils.js";

export default class FriendConnection extends ConnectionSession {
  private userId: number;
  private username: string;
  private gameId: string;
  private otherUserId: number | null = null;

  constructor(
    connection: any,
    req: any,
    mode: string,
    gameManager: GameManager,
    userId: number,
    username: string,
    gameId: string
  ) {
    super(connection, req, mode, gameManager);
    this.userId = userId;
    this.username = username;
    this.gameId = gameId;
  }

  protected async handleMessage(data: any) {
    switch (data.type) {
      case "newGame":
        if (this.fetchGame()) break;
        if (!this.game) {
          try {
            await this.checkInvite();
          } catch (err) {
            sendErrorToClient(this.connection, (err as Error).message);
            return;
          }
          this.fetchGame();
        }
        this.joinGame();
        break;
      case "nextGame":
        this.stopGame();
        break;
      default:
        break;
    }
  }

  public onClose() {
    if (this.game) {
      this.game.disconnect(this.connection);
      if (this.game.connectionCount() === 0 && this.game.isWaiting) {
        this.stopGame();
      }
    }
  }

  protected stopGame(): void {
    try {
      if (this.game && this.game.isConnected(this.connection)) {
        this.game.stop();
        this.gameManager.removeActiveGame(this.game);
        this.game.clients.forEach((client) => {
          this.gameManager.removeUserGame(client.playerInfo.userId, this.gameId);
        });
        this.game = null;
      }
    } catch (err) {
      console.error("Error stopping game:", err);
    }
  }

  private fetchGame(): boolean {
    this.game = this.gameManager.getUserGame(this.userId, this.gameId);
    if (this.game) {
      this.game.updateConnection(this.userId, this.connection);
      return true;
    }
    if (this.otherUserId !== null) {
      this.game = this.gameManager.getUserGame(this.otherUserId, this.gameId);
    }
    return this.game !== null;
  }

  protected joinGame() {
    if (!this.game) {
      this.game = createGame(this.mode, (game) => {
        this.gameManager.removeActiveGame(game);
        this.gameManager.removeUserGame(this.userId, this.gameId);
        if (this.otherUserId !== null) {
          this.gameManager.removeUserGame(this.otherUserId, this.gameId);
        }
      });
      this.game.connect(1, { userId: this.userId, username: this.username }, this.connection);
      this.game.freezeBall();
      this.game.gameId = this.gameId;
      this.gameManager.addActiveGame(this.game);
      this.gameManager.addUserGame(this.userId, this.game, this.gameId);
      this.gameManager.setWaitingRemote({
        playerInfo: { userId: this.userId, username: this.username },
        connection: this.connection,
        game: this.game,
      });
    } else {
      if (!this.game.updateConnection(this.userId, this.connection)) {
        let playerNum: 1 | 2 = this.game.clients.has(1) ? 2 : 1;
        this.game.connect(
          playerNum,
          { userId: this.userId, username: this.username },
          this.connection
        );
      }
      this.gameManager.addActiveGame(this.game);
      this.gameManager.addUserGame(this.userId, this.game, this.gameId);
      if (this.game.connectionCount() !== 2) return;
      this.game
        .runGameCountdown()
        .catch((err) => console.error("Error during online game countdown:", err));
    }
  }

  private async checkInvite() {
    const backendUrl = config.backendDatabase.url;
    const resp = await fetch(`${backendUrl}/api/internal/game-invites/${this.gameId}`, {
      headers: {
        "X-Service-Token": config.serviceAuth.secret,
      },
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      const errorMsg = "This invitation is no longer valid.";
      throw Error(errorMsg);
    }

    const json = await resp.json();
    const invite = json.data;
    if (!invite) {
      const errorMsg = "This invitation is no longer valid.";
      throw Error(errorMsg);
    }

    // Validate that the joining player is either inviter or invitee
    const invitedIds = [Number(invite.inviter_id), Number(invite.invitee_id)];
    if (!invitedIds.includes(Number(this.userId))) {
      const errorMsg = "You are not authorized to join this game.";
      throw Error(errorMsg);
    }
    this.otherUserId = invitedIds.find((id) => id !== Number(this.userId)) || null;
  }
}
