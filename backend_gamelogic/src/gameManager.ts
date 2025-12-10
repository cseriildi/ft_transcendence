import { GameServer, PlayerInfo } from "./gameTypes.js";
import { Tournament } from "./Tournament.js";

export type WaitingRemote = {
  playerInfo: PlayerInfo;
  connection: any;
  game: GameServer;
};

export class GameManager {
  private activeGames = new Set<GameServer>();
  private activePlayers = new Map<
    number,
    { online: GameServer | null; friend: Map<string, GameServer> | null }
  >();
  private activeTournaments = new Set<Tournament>();
  private waitingRemotePlayer: WaitingRemote | null = null;

  addTournament(t: Tournament) {
    this.activeTournaments.add(t);
  }

  removeTournament(t: Tournament) {
    this.activeTournaments.delete(t);
  }
  getWaitingRemote() {
    return this.waitingRemotePlayer;
  }

  isWaitingRemote(userId: number) {
    return this.waitingRemotePlayer && this.waitingRemotePlayer.playerInfo.userId === userId;
  }

  setWaitingRemote(waiting: WaitingRemote | null) {
    this.waitingRemotePlayer = waiting;
  }

  addActiveGame(game: GameServer) {
    this.activeGames.add(game);
  }

  removeActiveGame(game: GameServer) {
    this.activeGames.delete(game);
  }

  addUserGame(userId: number, game: GameServer, gameId?: string) {
    if (!this.activePlayers.has(userId)) {
      this.activePlayers.set(userId, { online: null, friend: null });
    }
    const playerEntry = this.activePlayers.get(userId);
    if (!gameId) {
      playerEntry!.online = game;
    } else {
      if (!playerEntry!.friend) {
        playerEntry!.friend = new Map<string, GameServer>();
      }
      playerEntry!.friend.set(gameId, game);
    }
  }

  removeUserGame(userId: number, gameId?: string) {
    const playerEntry = this.activePlayers.get(userId);
    if (!playerEntry) return;

    if (!gameId) {
      playerEntry.online = null;
    } else {
      playerEntry.friend?.delete(gameId!);
      if (playerEntry.friend?.size === 0) {
        playerEntry.friend = null;
      }
    }
    if (!playerEntry.online && !playerEntry.friend) {
      this.activePlayers.delete(userId);
    }
  }

  getUserGame(userId: number, gameId?: string): GameServer | null {
    const playerEntry = this.activePlayers.get(userId);
    if (!playerEntry) return null;

    if (!gameId) {
      return playerEntry.online;
    } else if (playerEntry.friend) {
      return playerEntry.friend.get(gameId) || null;
    }
    return null;
  }

  stopAllGames() {
    this.activeGames.forEach((game) => {
      try {
        game.stop();
      } catch (err) {
        console.error("Error stopping game:", err);
      }
    });
    this.activeGames.clear();
    this.activePlayers.clear();
    this.waitingRemotePlayer = null;
    this.activeTournaments.clear();
  }

  getActiveGames() {
    return this.activeGames;
  }
}
