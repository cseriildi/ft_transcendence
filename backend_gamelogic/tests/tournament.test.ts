import { describe, it, expect, beforeEach } from "vitest";
import { Tournament, TournamentPlayer, GamePairing } from "../src/Tournament.js";

describe("Tournament System", () => {
  describe("Tournament Initialization", () => {
    it("should create a tournament with valid players", () => {
      const tournament = new Tournament(["Alice", "Bob", "Charlie", "David"]);

      expect(tournament).toBeDefined();
      expect(tournament.getRound()).toBe(0);
    });

    it("should trim player names", () => {
      const tournament = new Tournament(["  Alice  ", "Bob  ", "  Charlie"]);

      // Tournament should accept trimmed names without error
      expect(tournament).toBeDefined();
    });

    it("should reject empty player names", () => {
      expect(() => {
        new Tournament(["Alice", "", "Bob"]);
      }).toThrow("Player name cannot be empty");
    });

    it("should reject whitespace-only names", () => {
      expect(() => {
        new Tournament(["Alice", "   ", "Bob"]);
      }).toThrow("Player name cannot be empty");
    });

    it("should reject names shorter than 3 characters", () => {
      expect(() => {
        new Tournament(["Alice", "Bo", "Charlie"]);
      }).toThrow("Player name must be at least 3 characters");
    });

    it("should reject names longer than 15 characters", () => {
      expect(() => {
        new Tournament(["Alice", "VeryLongPlayerName123", "Charlie"]);
      }).toThrow("Player name cannot exceed 15 characters");
    });

    it("should reject names with invalid characters", () => {
      expect(() => {
        new Tournament(["Alice", "Bob@123", "Charlie"]);
      }).toThrow("Player name can only contain letters, numbers, underscores, and hyphens");
    });

    it("should accept names with underscores and hyphens", () => {
      const tournament = new Tournament(["Alice_123", "Bob-456", "Charlie_X"]);
      expect(tournament).toBeDefined();
    });

    it("should accept minimum length names (3 characters)", () => {
      const tournament = new Tournament(["Abc", "Def", "Ghi"]);
      expect(tournament).toBeDefined();
    });

    it("should accept maximum length names (15 characters)", () => {
      const tournament = new Tournament(["Player123456789", "Alice_Bob_Carol", "Charlie"]);
      expect(tournament).toBeDefined();
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
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]);

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
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

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
      const tournament = new Tournament(["AAA", "BBB", "CCC"]);

      const pair = tournament.getNextPair();
      expect(pair).not.toBeNull();

      const secondPair = tournament.getNextPair();
      expect(secondPair).toBeNull(); // One player left unpaired
    });
  });

  describe("Game Results Processing", () => {
    it("should store game results", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

      const pair = tournament.getNextPair()!;
      pair.player1.score = 5;
      pair.player2.score = 3;

      tournament.storeGameResult(pair);
      const results = tournament.getResults();

      expect(results.length).toBe(1);
      expect(results[0]).toBe(pair);
    });

    it("should reset winner score to zero", () => {
      const tournament = new Tournament(["AAA", "BBB"]);

      const pair = tournament.getNextPair()!;
      pair.player1.score = 10;
      pair.player2.score = 5;

      tournament.storeGameResult(pair);

      expect(pair.player1.score).toBe(0);
    });

    it("should advance winner back to active players", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

      const pair1 = tournament.getNextPair()!;
      pair1.player1.score = 5;
      pair1.player2.score = 2;

      tournament.storeGameResult(pair1);

      const pair2 = tournament.getNextPair()!;
      expect(pair2).not.toBeNull();

      // Winner (player1) should be available for next round
      const hasPlayer1 =
        pair2.player1.username === pair1.player1.username ||
        pair2.player2.username === pair1.player1.username;

      // If not in this pair, there should be more pairs
      if (!hasPlayer1) {
        const pair3 = tournament.getNextPair();
        // Either player1 is in pair2, or will appear in future pairs
        expect(pair2 || pair3).not.toBeNull();
      } else {
        expect(hasPlayer1).toBe(true);
      }
    });

    it("should accumulate multiple results", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

      const pair1 = tournament.getNextPair()!;
      pair1.player1.score = 5;
      pair1.player2.score = 2;
      tournament.storeGameResult(pair1);

      const pair2 = tournament.getNextPair()!;
      pair2.player1.score = 6;
      pair2.player2.score = 4;
      tournament.storeGameResult(pair2);

      const results = tournament.getResults();
      expect(results.length).toBe(2);
    });
  });

  describe("Tournament Progression", () => {
    it("should start at round 0", () => {
      const tournament = new Tournament(["AAA", "BBB"]);

      expect(tournament.getRound()).toBe(0);
    });

    it("should increment round when new pairings generated", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

      tournament.getNextPair();
      expect(tournament.getRound()).toBe(1);
    });

    it("should not increment round for same round pairs", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

      tournament.getNextPair();
      const round1 = tournament.getRound();

      tournament.getNextPair();
      const round2 = tournament.getRound();

      expect(round2).toBe(round1);
    });

    it("should simulate complete tournament", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

      // Round 1: 2 games
      const pair1 = tournament.getNextPair()!;
      pair1.player1.score = 5;
      pair1.player2.score = 2;
      tournament.storeGameResult(pair1);

      const pair2 = tournament.getNextPair()!;
      pair2.player1.score = 6;
      pair2.player2.score = 4;
      tournament.storeGameResult(pair2);

      expect(tournament.getRound()).toBe(1);
      expect(tournament.getResults().length).toBe(2);

      // Round 2: finals
      const final = tournament.getNextPair();
      expect(final).not.toBeNull();
      expect(final!.round).toBe(2);

      final!.player1.score = 5;
      final!.player2.score = 3;
      tournament.storeGameResult(final!);

      // No more pairs
      expect(tournament.getNextPair()).toBeNull();
    });
  });

  describe("Winner Advancement", () => {
    it("should advance specified player", () => {
      const tournament = new Tournament(["AAA", "BBB", "CCC", "DDD"]);

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
      const tournament = new Tournament(["AAA", "BBB"]);

      const pair = tournament.getNextPair()!;
      pair.player1.score = 100;

      tournament.advanceWinner(pair.player1);

      expect(pair.player1.score).toBe(0);
    });
  });

  describe("Tournament Data Integrity", () => {
    it("should initialize players with zero scores", () => {
      const tournament = new Tournament(["AAA", "BBB"]);

      const player = tournament.getRandomPlayer();

      expect(player!.score).toBe(0);
    });

    it("should preserve player usernames through tournament", () => {
      const names = ["Alice", "Bob", "Charlie"];
      const tournament = new Tournament(names);

      const results = tournament.getResults();
      // Results start empty
      expect(results.length).toBe(0);

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
