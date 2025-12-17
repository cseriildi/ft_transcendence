import { GameManager } from "./gameManager.js";
import { GameServer } from "./gameTypes.js";
import { TournamentPlayer, Tournament } from "./Tournament.js";
import { createGame } from "./gameUtils.js";

export class RemoteTournament extends Tournament {
  private players: Map<number, { connection: any; game: GameServer | null }> = new Map();
  private createdAt: Date;
  private waiting: boolean = true;
  private gameManager: GameManager;
  private ongoingGames: Set<GameServer> = new Set();
  constructor(gameManager: GameManager) {
    super([]);
    this.createdAt = new Date();
    this.gameManager = gameManager;
    this.gameManager.setWaitingTournament(this);
    this.gameManager.addTournament(this);
  }

  addPlayer(player: TournamentPlayer, connection: any): void {
    this.waitingPlayers.add(player);
    if (this.getPlayerCount() == 8) {
      this.gameManager.setWaitingTournament(null);
      this.waiting = false;
    }
    this.players.set(player.userId, { connection: connection, game: null });
    let currentPlayers: string[] = [];
    this.waitingPlayers.forEach((p) => currentPlayers.push(p.username));
    this.broadcastMessage({
      type: "playerJoined",
      username: player.username,
      players: currentPlayers,
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

  updatePlayerConnection(userId: number, connection: any): boolean {
    const playerData = this.players.get(userId);
    let game = this.fetchGame(userId);
    if (game) {
      game.updateConnection(userId, connection);
    }
    if (playerData) {
      if (playerData.connection !== connection) {
        playerData.connection = connection;
        this.players.set(userId, playerData);
        return true;
      }
    }
    return false;
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
      const game = createGame("remoteTournament", (game) => {
        this.gameManager.removeActiveGame(game);
        this.players.get(pairing.player1.userId)!.game = null;
        this.players.get(pairing.player2.userId)!.game = null;
        this.ongoingGames.delete(game);
        if (this.ongoingGames.size === 0) {
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
      game.clients.set(1, {
        playerInfo: { username: pairing.player1.username, userId: pairing.player1.userId },
        connection: this.players.get(pairing.player1.userId)?.connection,
      });
      game.clients.set(2, {
        playerInfo: { username: pairing.player2.username, userId: pairing.player2.userId },
        connection: this.players.get(pairing.player2.userId)?.connection,
      });
      game.freezeBall();
      this.players.get(pairing.player1.userId)!.game = game;
      this.players.get(pairing.player2.userId)!.game = game;
      this.ongoingGames.add(game);
      game.runGameCountdown();
    });
  }

  fetchGame(userId: number): GameServer | null {
    const playerData = this.players.get(userId);
    return playerData ? playerData.game : null;
  }
}
