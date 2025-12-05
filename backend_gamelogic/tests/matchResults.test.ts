import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGame, updateGameState } from "../src/gameUtils.js";
import { PlayerInfo } from "../src/gameTypes.js";

describe("Match Result Reporting", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("OK"),
    } as Response);

    // Mock console to keep output clean
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should send match result for remote game when score limit reached", async () => {
    const game = createGame("remote");
    const player1: PlayerInfo = { userId: 1, username: "P1" };
    const player2: PlayerInfo = { userId: 2, username: "P2" };

    // Setup players
    game.connect(1, player1, { id: "c1" });
    game.connect(2, player2, { id: "c2" });

    // Set score to win
    game.score1 = game.maxScore;
    game.score2 = 0;

    // Trigger update
    updateGameState(game);

    // Wait for async operations (fetch is called without await in updateGameState)
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"winner_id":1'),
      })
    );
  });

  it("should NOT send match result for local game", async () => {
    const game = createGame("local");
    game.score1 = game.maxScore;

    updateGameState(game);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should delete friend invite after friend game ends", async () => {
    const game = createGame("friend");
    game.gameId = "invite-123";
    const player1: PlayerInfo = { userId: 1, username: "P1" };
    const player2: PlayerInfo = { userId: 2, username: "P2" };

    game.connect(1, player1, { id: "c1" });
    game.connect(2, player2, { id: "c2" });

    game.score1 = game.maxScore;

    updateGameState(game);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should call match result AND delete invite
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Check for delete call
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/game-invites/invite-123"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("should handle fetch errors gracefully", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const game = createGame("remote");
    const player1: PlayerInfo = { userId: 1, username: "P1" };
    const player2: PlayerInfo = { userId: 2, username: "P2" };
    game.connect(1, player1, { id: "c1" });
    game.connect(2, player2, { id: "c2" });
    game.score1 = game.maxScore;

    updateGameState(game);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should have logged error but not crashed
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error sending match result"),
      expect.any(Error)
    );
  });

  it("should log error when server returns non-200 for match result", async () => {
    // Mock server returning 500 error
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as Response);

    const game = createGame("remote");
    const player1: PlayerInfo = { userId: 1, username: "P1" };
    const player2: PlayerInfo = { userId: 2, username: "P2" };
    game.connect(1, player1, { id: "c1" });
    game.connect(2, player2, { id: "c2" });
    game.score1 = game.maxScore;

    updateGameState(game);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to save match result: 500 Internal Server Error")
    );
  });

  it("should log warning when server returns non-200 for invite deletion", async () => {
    // First call (POST match) succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("OK"),
    } as Response);

    // Second call (DELETE invite) fails
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Invite not found"),
    } as Response);

    const game = createGame("friend");
    game.gameId = "invite-123";
    const player1: PlayerInfo = { userId: 1, username: "P1" };
    const player2: PlayerInfo = { userId: 2, username: "P2" };
    game.connect(1, player1, { id: "c1" });
    game.connect(2, player2, { id: "c2" });
    game.score1 = game.maxScore;

    updateGameState(game);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to delete friend invitation invite-123: 404 Invite not found")
    );
  });
});
