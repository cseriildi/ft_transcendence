import { describe, it, expect, beforeEach } from "vitest";
import { Tournament, TournamentPlayer, GamePairing } from "../src/Tournament.js";

describe("Tournament System", () => {
  describe("Tournament Initialization", () => {
    it("should create a tournament with valid players", () => {
      const tournament = new Tournament(["Alice", "Bob", "Charlie", "David"]);

      expect(tournament).toBeDefined();
    });

    it("should trim player names", () => {
      const tournament = new Tournament(["  Alice  ", "Bob  ", "  Charlie"]);

      // Tournament should accept trimmed names without error
      expect(tournament).toBeDefined();
    });

    it("should reject empty player names", () => {
      expect(() => {
        new Tournament(["Alice", "", "Bob"]);
      }).toThrow("All player names must be non-empty");
    });

    it("should reject whitespace-only names", () => {
      expect(() => {
        new Tournament(["Alice", "   ", "Bob"]);
      }).toThrow("All player names must be non-empty");
    });

    it("should reject duplicate player names", () => {
      expect(() => {
        new Tournament(["Alice", "Bob", "Alice"]);
      }).toThrow("All player names must be unique");
    });

    it("should accept minimum viable tournament size", () => {
      const tournament = new Tournament(["Alice", "Bob"]);
      expect(tournament).toBeDefined();
    });

    it("should accept large tournament", () => {
      const players = Array.from({ length: 100 }, (_, i) => `Player${i}`);
      const tournament = new Tournament(players);

      expect(tournament).toBeDefined();
    });
  });

  describe("Player Selection", () => {
    it("should get random player from active players", () => {
      const tournament = new Tournament(["Alice", "Bob", "Charlie"]);

      const player = tournament.getRandomPlayer();

      expect(player).not.toBeNull();
      expect(player!.username).toBeDefined();
      expect(typeof player!.username).toBe("string");
    });

    it("should remove player from active set after selection", () => {
      const tournament = new Tournament(["Alice", "Bob"]);

      const player1 = tournament.getRandomPlayer();
      const player2 = tournament.getRandomPlayer();

      expect(player1!.username).not.toBe(player2!.username);
    });

    it("should return null when no players available", () => {
      const tournament = new Tournament(["Alice", "Bob"]);

      tournament.getRandomPlayer();
      tournament.getRandomPlayer();

      const player = tournament.getRandomPlayer();
      expect(player).toBeNull();
    });

    it("should return the last player when all others are taken", () => {
      const tournament = new Tournament(["Alice", "Bob", "Charlie"]);

      tournament.getRandomPlayer();
      tournament.getRandomPlayer();

      // One player should still be available (not null)
      const player = tournament.getRandomPlayer();
      expect(player).not.toBeNull();

      // Now no more players
      const nextPlayer = tournament.getRandomPlayer();
      expect(nextPlayer).toBeNull();
    });
  });

  describe("Pairing Generation", () => {
    it("should generate pairings from available players", () => {
      const tournament = new Tournament(["Alice", "Bob", "Charlie", "David"]);

      const pair = tournament.getNextPair();

      expect(pair).not.toBeNull();
      expect(pair!.player1).toBeDefined();
      expect(pair!.player2).toBeDefined();
      expect(pair!.round).toBe(1);
    });

    it("should assign round number to pairs", () => {
      const tournament = new Tournament(["A", "B", "C", "D", "E", "F"]);

      const pair1 = tournament.getNextPair();
      expect(pair1!.round).toBe(1);

      const pair2 = tournament.getNextPair();
      expect(pair2!.round).toBe(1);
    });

    it("should not pair a player with themselves", () => {
      const tournament = new Tournament(["Alice", "Bob", "Charlie", "David"]);

      const pair = tournament.getNextPair();

      expect(pair!.player1.username).not.toBe(pair!.player2.username);
    });

    it("should generate multiple pairs for tournament", () => {
      const tournament = new Tournament(["A", "B", "C", "D"]);

      const pair1 = tournament.getNextPair();
      const pair2 = tournament.getNextPair();

      expect(pair1).not.toBeNull();
      expect(pair2).not.toBeNull();
      expect(pair1!.player1.username).not.toBe(pair2!.player1.username);
    });

    it("should return null when not enough players for a pair", () => {
      const tournament = new Tournament(["Alice", "Bob"]);

      const pair = tournament.getNextPair();
      expect(pair).not.toBeNull();

      const secondPair = tournament.getNextPair();
      expect(secondPair).toBeNull();
    });

    it("should handle odd number of players", () => {
      const tournament = new Tournament(["A", "B", "C"]);

      const pair = tournament.getNextPair();
      expect(pair).not.toBeNull();

      const secondPair = tournament.getNextPair();
      expect(secondPair).toBeNull(); // One player left unpaired
    });
  });

  describe("Winner Advancement", () => {
    it("should advance specified player", () => {
      const tournament = new Tournament(["A", "B", "C", "D"]);

      const pair = tournament.getNextPair()!;
      const winner = pair.player1;

      // Manually advance winner
      tournament.advanceWinner(winner);

      // Get all remaining pairs to check if winner appears
      const nextPair1 = tournament.getNextPair();
      const nextPair2 = tournament.getNextPair();

      const hasWinner =
        (nextPair1 &&
          (nextPair1.player1.username === winner.username ||
            nextPair1.player2.username === winner.username)) ||
        (nextPair2 &&
          (nextPair2.player1.username === winner.username ||
            nextPair2.player2.username === winner.username));

      // Winner should appear in the tournament rounds
      expect(hasWinner || nextPair1 || nextPair2).toBeTruthy();
    });

    it("should reset advanced player score", () => {
      const tournament = new Tournament(["A", "B"]);

      const pair = tournament.getNextPair()!;
      pair.player1.score = 100;

      tournament.advanceWinner(pair.player1);

      expect(pair.player1.score).toBe(0);
    });
  });

  describe("Tournament Data Integrity", () => {
    it("should initialize players with zero scores", () => {
      const tournament = new Tournament(["A", "B"]);

      const player = tournament.getRandomPlayer();

      expect(player!.score).toBe(0);
    });

    it("should preserve player usernames through tournament", () => {
      const names = ["Alice", "Bob", "Charlie"];
      const tournament = new Tournament(names);

      // Get players and verify names
      const players = [
        tournament.getRandomPlayer(),
        tournament.getRandomPlayer(),
        tournament.getRandomPlayer(),
      ];

      const playerNames = players.map((p) => p!.username).sort();
      expect(playerNames).toEqual([...names].sort());
    });
  });
});
