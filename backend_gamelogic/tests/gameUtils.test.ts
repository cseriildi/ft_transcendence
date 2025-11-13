import { describe, it, expect, beforeEach } from "vitest";
import { Field, Ball, Paddle } from "../src/gameTypes.js";
import { closestPointOnSegment, resetBall, createGame } from "../src/gameUtils.js";
import { config } from "../src/config.js";

describe("Game Utilities", () => {
  describe("Field", () => {
    it("should create a field with specified dimensions", () => {
      const field = new Field(800, 600);
      expect(field.width).toBe(800);
      expect(field.height).toBe(600);
    });
  });

  describe("Ball", () => {
    let field: Field;

    beforeEach(() => {
      field = new Field(800, 600);
    });

    it("should create a ball at field center", () => {
      const ball = new Ball(field);
      expect(ball.x).toBe(field.width / 2);
      expect(ball.y).toBe(field.height / 2);
      expect(ball.radius).toBe(config.game.ballRadius);
    });

    it("should have initial speed values", () => {
      const ball = new Ball(field);
      expect(ball.speedX).toBeDefined();
      expect(ball.speedY).toBeDefined();
      expect(typeof ball.speedX).toBe("number");
      expect(typeof ball.speedY).toBe("number");
    });

    it("should have non-zero speed", () => {
      const ball = new Ball(field);
      const speed = Math.sqrt(ball.speedX ** 2 + ball.speedY ** 2);
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe("Paddle", () => {
    let field: Field;

    beforeEach(() => {
      field = new Field(800, 600);
    });

    it("should create a paddle at correct position", () => {
      const paddle1 = new Paddle(1, field, 5);
      const paddle2 = new Paddle(2, field, 5);

      expect(paddle1.cy).toBe(field.height / 2);
      expect(paddle2.cy).toBe(field.height / 2);
      expect(paddle1.cx).toBeLessThan(field.width / 2);
      expect(paddle2.cx).toBeGreaterThan(field.width / 2);
    });

    it("should have correct dimensions", () => {
      const paddle = new Paddle(1, field, 5);
      expect(paddle.length).toBe(field.height / 5);
      expect(paddle.width).toBe(field.width / 50);
      expect(paddle.speed).toBe(5);
    });

    it("should initialize with zero y-speed", () => {
      const paddle = new Paddle(1, field, 5);
      expect(paddle.ySpeed).toBe(0);
    });

    it("should return capsule with correct properties", () => {
      const paddle = new Paddle(1, field, 5);
      const capsule = paddle.getCapsule();

      expect(capsule).toHaveProperty("x1");
      expect(capsule).toHaveProperty("y1");
      expect(capsule).toHaveProperty("x2");
      expect(capsule).toHaveProperty("y2");
      expect(capsule).toHaveProperty("R");
      expect(typeof capsule.R).toBe("number");
    });
  });

  describe("closestPointOnSegment", () => {
    let field: Field;
    let paddle: Paddle;
    let ball: Ball;

    beforeEach(() => {
      field = new Field(800, 600);
      paddle = new Paddle(1, field, 5);
      ball = new Ball(field);
    });

    it("should return a point with x and y coordinates", () => {
      const point = closestPointOnSegment(paddle, ball);
      expect(point).toHaveProperty("x");
      expect(point).toHaveProperty("y");
      expect(typeof point.x).toBe("number");
      expect(typeof point.y).toBe("number");
    });

    it("should return finite coordinates", () => {
      const point = closestPointOnSegment(paddle, ball);
      expect(isFinite(point.x)).toBe(true);
      expect(isFinite(point.y)).toBe(true);
    });
  });

  describe("resetBall", () => {
    it("should reset ball to center of field", () => {
      const game = createGame();

      // Move ball away from center
      game.Ball.x = 100;
      game.Ball.y = 100;

      resetBall(game);

      expect(game.Ball.x).toBe(game.Field.width / 2);
      expect(game.Ball.y).toBe(game.Field.height / 2);
    });

    it("should reset ball speed", () => {
      const game = createGame();

      // Set ball speed to zero
      game.Ball.speedX = 0;
      game.Ball.speedY = 0;

      resetBall(game);

      const speed = Math.sqrt(game.Ball.speedX ** 2 + game.Ball.speedY ** 2);
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe("createGame", () => {
    it("should create a game server instance", () => {
      const game = createGame();
      expect(game).toBeDefined();
      expect(game).toHaveProperty("Ball");
      expect(game).toHaveProperty("Field");
      expect(game).toHaveProperty("Paddle1");
      expect(game).toHaveProperty("Paddle2");
    });

    it("should initialize scores to zero", () => {
      const game = createGame();
      expect(game.score1).toBe(0);
      expect(game.score2).toBe(0);
    });

    it("should have a clients set", () => {
      const game = createGame();
      expect(game.clients).toBeDefined();
      expect(game.clients instanceof Set).toBe(true);
    });
  });
});
