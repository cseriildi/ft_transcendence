import { GameManager } from "./gameManager.js";
import { GameServer } from "./gameTypes.js";
import { TournamentPlayer, Tournament } from "./Tournament.js";
import { createGame } from "./gameUtils.js";
import { sendErrorToClient, broadcastGameSetup } from "./networkUtils.js";

export class RemoteTournament extends Tournament {
  private players: Map<number, { connection: any; game: GameServer | null }> = new Map();
  private createdAt: Date;
  private waiting: boolean = true;
  private gameManager: GameManager;
  private activeGameCount: number = 0;
  private maxPlayers: number = 2;
  constructor(gameManager: GameManager) {
    super([]);
    this.createdAt = new Date();
    this.gameManager = gameManager;
    this.gameManager.setWaitingTournament(this);
    this.gameManager.addTournament(this);
  }

  addPlayer(player: TournamentPlayer, connection: any): void {
    this.waitingPlayers.add(player);
    if (this.getPlayerCount() === this.maxPlayers) {
      this.gameManager.setWaitingTournament(null);
      this.waiting = false;
    }
    this.players.set(player.userId, { connection: connection, game: null });
    this.broadcastMessage({
      type: "playerJoined",
      username: player.username,
      players: Array.from(this.waitingPlayers, (p) => p.username),
    });
    this.gameManager.addTournamentPlayer(player.userId, this);
    if (!this.waiting) {
      this.generatePairings();
      this.createGames();
    }
  }

  getPlayerCount(): number {
    return this.waitingPlayers.size;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  isWaiting(): boolean {
    return this.waiting;
  }

  disconnect(connection: any): void {
    if (!connection) return;
    for (const [userId, playerData] of this.players.entries()) {
      if (playerData.connection === connection) {
        try {
          if (
            playerData.connection &&
            playerData.connection.readyState === playerData.connection.OPEN
          ) {
            sendErrorToClient(connection, "You have been disconnected");
            connection.close();
          }
        } catch (err) {
          console.error("Error closing connection:", err);
        }
        // Clear connection in tournament
        playerData.connection = null;
        this.players.set(userId, playerData);

        // Also clear connection in game if player has one
        if (playerData.game) {
          const currentClient = Array.from(playerData.game.clients.values()).find(
            (client) => client.playerInfo.userId === userId
          );
          if (currentClient) {
            currentClient.connection = null;
          }
        }
        break;
      }
    }
  }

  updatePlayerConnection(userId: number, connection: any): boolean {
    const playerData = this.players.get(userId);
    if (!playerData || !connection || playerData.connection === connection) {
      return false;
    }

    this.disconnect(playerData.connection);
    playerData.connection = connection;
    if (playerData.game) {
      const currentClient = Array.from(playerData.game.clients.values()).find(
        (client) => client.playerInfo.userId === userId
      );
      if (currentClient) {
        currentClient.connection = connection;
      }
    }
    this.players.set(userId, playerData);
    return true;
  }

  broadcastMessage(message: any): void {
    this.players.forEach((playerData) => {
      if (
        playerData.connection &&
        playerData.connection.readyState === playerData.connection.OPEN
      ) {
        playerData.connection.send(JSON.stringify(message));
      }
    });
  }

  generatePairings(): void {
    super["generatePairings"]();
    let pairs: { player1: string; player2: string; round: number }[] = [];
    this.currentRound.forEach((pairing) => {
      pairs.push({
        player1: pairing.player1.username,
        player2: pairing.player2.username,
        round: pairing.round,
      });
    });
    this.broadcastMessage({ type: "newRound", mode: "remoteTournament", pairs: pairs });
  }

  createGames(): void {
    this.currentRound.forEach((pairing) => {
      this.activeGameCount++;
      const game = createGame("remoteTournament", (game) => {
        this.gameManager.removeActiveGame(game);

        // Clear game connections before setting game to null
        for (const client of game.clients.values()) {
          client.connection = null;
        }

        this.players.get(pairing.player1.userId)!.game = null;
        this.players.get(pairing.player2.userId)!.game = null;
        this.activeGameCount--;
        if (this.activeGameCount === 0) {
          if (this.waitingPlayers.size >= 2) {
            this.generatePairings();
            this.createGames();
          } else {
            this.broadcastMessage({ type: "tournamentComplete" });
            this.gameManager.removeTournament(this);
            for (const playerId of this.players.keys()) {
              this.gameManager.removeTournamentPlayer(playerId);
            }
          }
        }
      });

      this.gameManager.addActiveGame(game);
      game.tournament = this;

      // Get connections from tournament's stored connections
      const player1Data = this.players.get(pairing.player1.userId);
      const player2Data = this.players.get(pairing.player2.userId);
      const player1Connection = player1Data?.connection || null;
      const player2Connection = player2Data?.connection || null;

      game.clients.set(1, {
        playerInfo: { username: pairing.player1.username, userId: pairing.player1.userId },
        connection: player1Connection,
      });
      game.clients.set(2, {
        playerInfo: { username: pairing.player2.username, userId: pairing.player2.userId },
        connection: player2Connection,
      });

      // Update game references (keep connections in sync)
      if (player1Data) {
        player1Data.game = game;
        this.players.set(pairing.player1.userId, player1Data);
      }
      if (player2Data) {
        player2Data.game = game;
        this.players.set(pairing.player2.userId, player2Data);
      }

      game.freezeBall();
      game.runGameCountdown();
    });
    this.currentRound.clear();
  }

  fetchGame(userId: number): GameServer | null {
    const playerData = this.players.get(userId);
    return playerData ? playerData.game : null;
  }

  getAllConnections(): any[] {
    return Array.from(this.players.values())
      .map((pdata) => pdata.connection)
      .filter((conn) => conn !== null);
  }
}
