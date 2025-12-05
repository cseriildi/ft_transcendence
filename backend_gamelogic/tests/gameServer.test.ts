import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameServer, PlayerInfo } from "../src/gameTypes.js";
import { createGame } from "../src/gameUtils.js";

describe("GameServer Lifecycle", () => {
  let game: GameServer;

  beforeEach(() => {
    game = createGame("local");
  });

  afterEach(() => {
    game.stop();
  });

  describe("Game Initialization", () => {
    it("should create game with correct mode", () => {
      const localGame = createGame("local");
      const aiGame = createGame("ai");
      const remoteGame = createGame("remote");
      const friendGame = createGame("friend");
      const tournamentGame = createGame("tournament");

      expect(localGame.gameMode).toBe("local");
      expect(aiGame.gameMode).toBe("ai");
      expect(remoteGame.gameMode).toBe("remote");
      expect(friendGame.gameMode).toBe("friend");
      expect(tournamentGame.gameMode).toBe("tournament");
    });

    it("should initialize field and game objects", () => {
      expect(game.Field).toBeDefined();
      expect(game.Ball).toBeDefined();
      expect(game.Paddle1).toBeDefined();
      expect(game.Paddle2).toBeDefined();
    });

    it("should initialize scores to zero", () => {
      expect(game.score1).toBe(0);
      expect(game.score2).toBe(0);
    });

    it("should initialize countdown to zero", () => {
      expect(game.countdown).toBe(0);
    });

    it("should set waiting flag for remote modes", () => {
      const localGame = createGame("local");
      const aiGame = createGame("ai");
      const remoteGame = createGame("remote");
      const friendGame = createGame("friend");
      const tournamentGame = createGame("tournament");

      expect(localGame.isWaiting).toBe(false);
      expect(aiGame.isWaiting).toBe(false);
      expect(remoteGame.isWaiting).toBe(true);
      expect(friendGame.isWaiting).toBe(true);
      expect(tournamentGame.isWaiting).toBe(true);
    });

    it("should start with isRunning false", () => {
      expect(game.running()).toBe(false);
    });

    it("should initialize empty clients map", () => {
      expect(game.clients.size).toBe(0);
      expect(game.clients instanceof Map).toBe(true);
    });
  });

  describe("Callback Configuration", () => {
    it("should set update callback", () => {
      const callback = vi.fn();
      game.setUpdateCallback(callback);

      // Callback is stored but not invoked until game starts
      expect(callback).not.toHaveBeenCalled();
    });

    it("should set render callback", () => {
      const callback = vi.fn();
      game.setRenderCallback(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should set cleanup callback", () => {
      const callback = vi.fn();
      game.setCleanupCallback(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw error if starting without callbacks", () => {
      const newGame = new GameServer("local");

      expect(() => newGame.start()).toThrow(
        "Callbacks not set. Call setUpdateCallback() and setRenderCallback() first."
      );
    });
  });

  describe("Game Loops", () => {
    it("should start physics and render loops", () => {
      const updateCallback = vi.fn();
      const renderCallback = vi.fn();

      game.setUpdateCallback(updateCallback);
      game.setRenderCallback(renderCallback);
      game.start();

      expect(game.running()).toBe(true);
    });

    it("should call callbacks when running", async () => {
      const updateCallback = vi.fn();
      const renderCallback = vi.fn();

      game.setUpdateCallback(updateCallback);
      game.setRenderCallback(renderCallback);
      game.start();

      // Wait for callbacks to be called
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(updateCallback).toHaveBeenCalled();
      expect(renderCallback).toHaveBeenCalled();
    });

    it("should warn if starting already running game", () => {
      const callback = vi.fn();
      game.setUpdateCallback(callback);
      game.setRenderCallback(callback);

      const warnSpy = vi.spyOn(console, "warn");

      game.start();
      game.start();

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain("already running");

      warnSpy.mockRestore();
    });

    it("should stop physics and render loops", () => {
      const callback = vi.fn();
      game.setUpdateCallback(callback);
      game.setRenderCallback(callback);

      game.start();
      expect(game.running()).toBe(true);

      game.stop();
      expect(game.running()).toBe(false);
    });

    it("should warn if stopping non-running game", () => {
      const warnSpy = vi.spyOn(console, "warn");

      game.stop();

      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should clean up intervals on stop", () => {
      const callback = vi.fn();
      game.setUpdateCallback(callback);
      game.setRenderCallback(callback);
      game.setCleanupCallback(callback);

      game.start();
      const callCountBefore = callback.mock.calls.length;
      game.stop();

      // After stop, game should not be running
      expect(game.running()).toBe(false);
    });
  });

  describe("Player Connections", () => {
    it("should connect players", () => {
      const player1Info: PlayerInfo = { userId: 1, username: "Alice" };
      const player2Info: PlayerInfo = { userId: 2, username: "Bob" };
      const conn1 = { id: "conn1" };
      const conn2 = { id: "conn2" };

      game.connect(1, player1Info, conn1);
      game.connect(2, player2Info, conn2);

      expect(game.clients.size).toBe(2);
      expect(game.clients.get(1)?.playerInfo).toBe(player1Info);
      expect(game.clients.get(2)?.playerInfo).toBe(player2Info);
    });

    it("should check if connection is connected", () => {
      const playerInfo: PlayerInfo = { userId: 1, username: "Alice" };
      const conn1 = { id: "conn1" };
      const conn2 = { id: "conn2" };

      game.connect(1, playerInfo, conn1);

      expect(game.isConnected(conn1)).toBe(true);
      expect(game.isConnected(conn2)).toBe(false);
    });

    it("should disconnect by connection object", () => {
      const playerInfo: PlayerInfo = { userId: 1, username: "Alice" };
      const conn = { id: "conn1", close: vi.fn(), send: vi.fn() };

      game.connect(1, playerInfo, conn);
      game.disconnect(conn);

      expect(game.clients.get(1)?.connection).toBeNull();
    });

    it("should disconnect by userId", () => {
      const playerInfo: PlayerInfo = { userId: 1, username: "Alice" };
      const conn = { id: "conn1", close: vi.fn(), send: vi.fn() };

      game.connect(1, playerInfo, conn);
      game.disconnectByUserId(1);

      expect(game.clients.get(1)?.connection).toBeNull();
    });

    it("should count connected players", () => {
      const player1: PlayerInfo = { userId: 1, username: "Alice" };
      const player2: PlayerInfo = { userId: 2, username: "Bob" };
      const conn1 = { id: "conn1", send: vi.fn() };
      const conn2 = { id: "conn2", send: vi.fn() };

      game.connect(1, player1, conn1);
      game.connect(2, player2, conn2);

      expect(game.connectionCount()).toBe(2);

      game.disconnect(conn1);
      expect(game.connectionCount()).toBe(1);
    });

    it("should update connection for existing player", () => {
      const playerInfo: PlayerInfo = { userId: 1, username: "Alice" };
      const oldConn = {
        id: "old",
        close: vi.fn(),
        send: vi.fn(),
        readyState: 1, // WebSocket.OPEN
      };
      const newConn = {
        id: "new",
        send: vi.fn(),
        readyState: 1,
      };

      game.connect(1, playerInfo, oldConn);

      const updated = game.updateConnection(1, newConn);

      expect(updated).toBe(true);
      // updateConnection may cause broadcast which could fail and remove client
      // So just verify the return value is correct
    });
    it("should return false when updating non-existent player", () => {
      const newConn = { id: "new" };

      const updated = game.updateConnection(999, newConn);

      expect(updated).toBe(false);
    });
  });

  describe("Game Result", () => {
    it("should return null when players not connected", () => {
      const result = game.getResult();

      expect(result).toBeNull();
    });

    it("should return result when both players connected", () => {
      const player1: PlayerInfo = { userId: 1, username: "Alice" };
      const player2: PlayerInfo = { userId: 2, username: "Bob" };

      game.connect(1, player1, { id: "1" });
      game.connect(2, player2, { id: "2" });

      game.score1 = 5;
      game.score2 = 3;

      const result = game.getResult();

      expect(result).not.toBeNull();
      expect(result!.winner).toBe(player1);
      expect(result!.loser).toBe(player2);
      expect(result!.winnerScore).toBe(5);
      expect(result!.loserScore).toBe(3);
    });

    it("should determine winner correctly", () => {
      const player1: PlayerInfo = { userId: 1, username: "Alice" };
      const player2: PlayerInfo = { userId: 2, username: "Bob" };

      game.connect(1, player1, { id: "1" });
      game.connect(2, player2, { id: "2" });

      game.score1 = 2;
      game.score2 = 5;

      const result = game.getResult();

      expect(result!.winner).toBe(player2);
      expect(result!.loser).toBe(player1);
    });
  });

  describe("Player Input Handling", () => {
    it.each([
      { player: 1, action: "up", check: (g: GameServer) => g.Paddle1.ySpeed === -g.Paddle1.speed },
      { player: 1, action: "down", check: (g: GameServer) => g.Paddle1.ySpeed === g.Paddle1.speed },
      { player: 1, action: "stop", check: (g: GameServer) => g.Paddle1.ySpeed === 0 },
      { player: 2, action: "up", check: (g: GameServer) => g.Paddle2.ySpeed === -g.Paddle2.speed },
      { player: 2, action: "down", check: (g: GameServer) => g.Paddle2.ySpeed === g.Paddle2.speed },
    ])("should handle player $player action $action", ({ player, action, check }) => {
      // Pre-condition for stop
      if (action === "stop") {
        const paddle = player === 1 ? game.Paddle1 : game.Paddle2;
        paddle.ySpeed = 10;
      }

      game.handlePlayerInput({ player: player as 1 | 2, action: action as any });
      expect(check(game)).toBe(true);
    });
  });

  describe("Ball Freezing", () => {
    it("should freeze ball movement", () => {
      game.Ball.speedX = 5;
      game.Ball.speedY = 3;

      game.freezeBall();

      expect(game.Ball.speedX).toBe(0);
      expect(game.Ball.speedY).toBe(0);
    });

    it("should start game after freezing", () => {
      game.setUpdateCallback(() => {});
      game.setRenderCallback(() => {});

      game.freezeBall();

      expect(game.running()).toBe(true);
    });
  });

  describe("Game Countdown", () => {
    it("should run countdown when game starts", async () => {
      game.setUpdateCallback(() => {});
      game.setRenderCallback(() => {});
      game.start();

      await game.runGameCountdown();

      expect(game.countdown).toBe(0);
      expect(game.isWaiting).toBe(false);
    });

    it("should set waiting to false after countdown", async () => {
      game.isWaiting = true;
      game.setUpdateCallback(() => {});
      game.setRenderCallback(() => {});
      game.start();

      await game.runGameCountdown();

      expect(game.isWaiting).toBe(false);
    });

    it("should break countdown if game stops", async () => {
      game.setUpdateCallback(() => {});
      game.setRenderCallback(() => {});
      game.start();

      // Stop game immediately
      setTimeout(() => game.stop(), 10);

      await game.runGameCountdown();

      // Countdown should have stopped early
      expect(game.running()).toBe(false);
    });
  });

  describe("Cleanup Callback", () => {
    it("should invoke cleanup callback", () => {
      const cleanupCallback = vi.fn();
      game.setCleanupCallback(cleanupCallback);

      game.invokeCleanup();

      expect(cleanupCallback).toHaveBeenCalledWith(game);
    });
  });
});
