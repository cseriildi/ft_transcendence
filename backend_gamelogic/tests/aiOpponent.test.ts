import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameServer } from "../src/gameTypes.js";
import { updateDummyPaddle } from "../src/opponent/opponent.js";
import { predictInterceptionPoint, getErrorConfig } from "../src/opponent/opponent.utils.js";
import { createGame } from "../src/gameUtils.js";

describe("AI Opponent Logic", () => {
  let game: GameServer;

  beforeEach(() => {
    game = createGame("ai");
    // Reset AI state
    game.aiPlayer.aiLastDecisionTime = 0;
    game.aiPlayer.aiTargetY = null;
    game.isServe = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Configuration", () => {
    it("should return correct error config for difficulties", () => {
      const easy = getErrorConfig("easy");
      const medium = getErrorConfig("medium");
      const hard = getErrorConfig("hard");

      expect(easy.reactionTime).toBeGreaterThan(medium.reactionTime);
      expect(medium.reactionTime).toBeGreaterThan(hard.reactionTime);

      expect(easy.positionError).toBeGreaterThan(medium.positionError);
      expect(hard.positionError).toBeLessThan(medium.positionError);
    });
  });

  describe("Prediction Logic", () => {
    it("should return center when ball is moving away", () => {
      game.Ball.x = game.Field.width / 2;
      game.Ball.speedX = -5; // Moving left (away from AI on right)

      const prediction = predictInterceptionPoint(game, 2);
      expect(prediction).toBe(game.Field.height / 2);
    });

    it("should predict direct interception correctly", () => {
      // Ball moving straight right
      game.Ball.x = game.Field.width / 2;
      game.Ball.y = game.Field.height / 2;
      game.Ball.speedX = 10;
      game.Ball.speedY = 0;

      const prediction = predictInterceptionPoint(game, 2);
      expect(prediction).toBe(game.Field.height / 2);
    });

    it("should predict interception with wall bounce", () => {
      // Setup ball to bounce off bottom wall
      game.Ball.x = game.Field.width / 2;
      game.Ball.y = game.Field.height - 50;
      game.Ball.speedX = 10;
      game.Ball.speedY = 10; // Moving down-right

      const prediction = predictInterceptionPoint(game, 2);

      // It should bounce and end up higher than the bounce point
      expect(prediction).toBeLessThan(game.Field.height);
      expect(prediction).toBeGreaterThan(0);
    });
  });

  describe("Decision Making", () => {
    it("should not update target before reaction time elapses", () => {
      game.aiPlayer.aiDifficulty = "hard"; // 1000ms reaction
      game.aiPlayer.aiLastDecisionTime = Date.now(); // Just updated
      game.aiPlayer.aiTargetY = 100;

      updateDummyPaddle(game, 2);

      // Should not have changed
      expect(game.aiPlayer.aiTargetY).toBe(100);
    });

    it("should update target after reaction time elapses", () => {
      game.aiPlayer.aiDifficulty = "hard";
      game.aiPlayer.aiLastDecisionTime = Date.now() - 2000; // Long ago
      game.aiPlayer.aiTargetY = null;

      updateDummyPaddle(game, 2);

      expect(game.aiPlayer.aiTargetY).not.toBeNull();
      // Should update timestamp
      expect(game.aiPlayer.aiLastDecisionTime).toBeCloseTo(Date.now(), -2); // Within 100ms
    });

    it("should force update on serve", () => {
      game.isServe = true;
      game.aiPlayer.aiLastDecisionTime = Date.now(); // Just updated, normally would wait
      game.aiPlayer.aiTargetY = null;

      updateDummyPaddle(game, 2);

      expect(game.aiPlayer.aiTargetY).not.toBeNull();
      expect(game.isServe).toBe(false); // Should reset flag
    });

    it("should apply error to prediction", () => {
      // Mock random to return specific error
      // First call is chanceToExtraError (return 1 to fail check)
      // Second call is error direction/magnitude (return 0.5 for max positive error)
      const randomSpy = vi.spyOn(Math, "random");
      randomSpy.mockReturnValueOnce(1.0).mockReturnValueOnce(0.9);

      game.aiPlayer.aiDifficulty = "hard";
      game.aiPlayer.aiLastDecisionTime = 0;

      // Perfect prediction would be center
      game.Ball.y = game.Field.height / 2;
      game.Ball.speedY = 0;
      game.Ball.speedX = 10;

      updateDummyPaddle(game, 2);

      const perfectY = game.Field.height / 2;
      expect(game.aiPlayer.aiTargetY).not.toBe(perfectY);
    });
  });

  describe("Movement Execution", () => {
    it("should move paddle towards target", () => {
      game.aiPlayer.aiTargetY = 500;
      game.Paddle2.cy = 100; // Far above target

      // Force update to skip decision logic and go to movement
      // We can just call updateDummyPaddle, but we need to make sure it doesn't reset target
      // So we set lastDecisionTime to now
      game.aiPlayer.aiLastDecisionTime = Date.now();

      updateDummyPaddle(game, 2);

      expect(game.Paddle2.ySpeed).toBeGreaterThan(0); // Should move down (positive Y)
    });

    it("should stop when inside deadzone", () => {
      game.aiPlayer.aiTargetY = 300;
      game.Paddle2.cy = 305; // Very close
      game.aiPlayer.aiLastDecisionTime = Date.now();

      updateDummyPaddle(game, 2);

      expect(game.Paddle2.ySpeed).toBe(0);
    });
  });
});
