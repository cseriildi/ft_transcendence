import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameManager } from "../src/gameManager.js";
import { GameServer, PlayerInfo } from "../src/gameTypes.js";
import { Tournament } from "../src/Tournament.js";
import { createGame } from "../src/gameUtils.js";

describe("GameManager", () => {
  let gameManager: GameManager;

  beforeEach(() => {
    gameManager = new GameManager();
  });

  describe("Active Games Management", () => {
    it("should add an active game", () => {
      const game = createGame("local");
      gameManager.addActiveGame(game);

      expect(gameManager.getActiveGames().has(game)).toBe(true);
      expect(gameManager.getActiveGames().size).toBe(1);
    });

    it("should remove an active game", () => {
      const game = createGame("local");
      gameManager.addActiveGame(game);
      gameManager.removeActiveGame(game);

      expect(gameManager.getActiveGames().has(game)).toBe(false);
      expect(gameManager.getActiveGames().size).toBe(0);
    });

    it("should handle multiple active games", () => {
      const game1 = createGame("local");
      const game2 = createGame("ai");
      const game3 = createGame("remote");

      gameManager.addActiveGame(game1);
      gameManager.addActiveGame(game2);
      gameManager.addActiveGame(game3);

      expect(gameManager.getActiveGames().size).toBe(3);
      expect(gameManager.getActiveGames().has(game1)).toBe(true);
      expect(gameManager.getActiveGames().has(game2)).toBe(true);
      expect(gameManager.getActiveGames().has(game3)).toBe(true);
    });
  });

  describe("User Game Tracking", () => {
    it("should add an online game for a user", () => {
      const game = createGame("local");
      const userId = 123;

      gameManager.addUserGame(userId, game);

      expect(gameManager.getUserGame(userId)).toBe(game);
    });

    it("should add a friend game for a user", () => {
      const game = createGame("friend");
      const userId = 123;
      const gameId = "friend-game-1";

      gameManager.addUserGame(userId, game, gameId);

      expect(gameManager.getUserGame(userId, gameId)).toBe(game);
    });

    it("should return null for non-existent user game", () => {
      expect(gameManager.getUserGame(999)).toBeNull();
    });

    it("should handle multiple friend games for one user", () => {
      const game1 = createGame("friend");
      const game2 = createGame("friend");
      const userId = 123;

      gameManager.addUserGame(userId, game1, "game-1");
      gameManager.addUserGame(userId, game2, "game-2");

      expect(gameManager.getUserGame(userId, "game-1")).toBe(game1);
      expect(gameManager.getUserGame(userId, "game-2")).toBe(game2);
    });

    it("should remove a user game", () => {
      const game = createGame("local");
      const userId = 123;

      gameManager.addUserGame(userId, game);
      gameManager.removeUserGame(userId);

      expect(gameManager.getUserGame(userId)).toBeNull();
    });

    it("should remove a specific friend game", () => {
      const game1 = createGame("friend");
      const game2 = createGame("friend");
      const userId = 123;

      gameManager.addUserGame(userId, game1, "game-1");
      gameManager.addUserGame(userId, game2, "game-2");
      gameManager.removeUserGame(userId, "game-1");

      expect(gameManager.getUserGame(userId, "game-1")).toBeNull();
      expect(gameManager.getUserGame(userId, "game-2")).toBe(game2);
    });
  });

  describe("Tournament Management", () => {
    it("should add and remove a tournament", () => {
      const tournament = new Tournament(["Player1", "Player2", "Player3", "Player4"]);

      // We can't verify internal state directly without a getter,
      // but we can ensure it doesn't throw
      expect(() => gameManager.addTournament(tournament)).not.toThrow();
      expect(() => gameManager.removeTournament(tournament)).not.toThrow();
    });
  });

  describe("Waiting Remote Player Management", () => {
    it("should set and get waiting remote player", () => {
      const game = createGame("remote");
      const playerInfo: PlayerInfo = {
        userId: 123,
        username: "TestPlayer",
      };
      const connection = { id: "conn-1" };

      const waiting = { playerInfo, connection, game };
      gameManager.setWaitingRemote(waiting);

      expect(gameManager.getWaitingRemote()).toBe(waiting);
    });

    it("should check if user is waiting remote", () => {
      const game = createGame("remote");
      const playerInfo: PlayerInfo = {
        userId: 123,
        username: "TestPlayer",
      };
      const connection = { id: "conn-1" };

      gameManager.setWaitingRemote({ playerInfo, connection, game });

      expect(gameManager.isWaitingRemote(123)).toBe(true);
      expect(gameManager.isWaitingRemote(456)).toBe(false);
    });

    it("should clear waiting remote player", () => {
      const game = createGame("remote");
      const playerInfo: PlayerInfo = {
        userId: 123,
        username: "TestPlayer",
      };
      const connection = { id: "conn-1" };

      gameManager.setWaitingRemote({ playerInfo, connection, game });
      gameManager.setWaitingRemote(null);

      expect(gameManager.getWaitingRemote()).toBeNull();
    });
  });

  describe("Stop All Games", () => {
    it("should stop all active games", () => {
      const game1 = createGame("local");
      const game2 = createGame("ai");

      const stopSpy1 = vi.spyOn(game1, "stop");
      const stopSpy2 = vi.spyOn(game2, "stop");

      gameManager.addActiveGame(game1);
      gameManager.addActiveGame(game2);

      gameManager.stopAllGames();

      expect(stopSpy1).toHaveBeenCalled();
      expect(stopSpy2).toHaveBeenCalled();
      expect(gameManager.getActiveGames().size).toBe(0);
    });

    it("should handle errors when stopping games", () => {
      const game = createGame("local");
      game.stop = vi.fn(() => {
        throw new Error("Stop failed");
      });

      gameManager.addActiveGame(game);

      // Should not throw, should catch error
      expect(() => gameManager.stopAllGames()).not.toThrow();
    });

    it("should clear all data when stopping all games", () => {
      const game = createGame("local");
      const playerInfo: PlayerInfo = { userId: 123, username: "Player" };
      const connection = { id: "conn-1" };

      gameManager.addActiveGame(game);
      gameManager.addUserGame(123, game);
      gameManager.setWaitingRemote({ playerInfo, connection, game });

      const tournament = new Tournament(["Player1", "Player2", "Player3", "Player4"]);
      gameManager.addTournament(tournament);

      vi.spyOn(game, "stop");

      gameManager.stopAllGames();

      expect(gameManager.getActiveGames().size).toBe(0);
      expect(gameManager.getUserGame(123)).toBeNull();
      expect(gameManager.getWaitingRemote()).toBeNull();
    });
  });
});
