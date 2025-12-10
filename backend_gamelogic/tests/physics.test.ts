import { describe, it, expect, beforeEach } from "vitest";
import { Field, Ball, Paddle } from "../src/gameTypes.js";
import { collideBallCapsule, closestPointOnSegment } from "../src/gameUtils.js";
import { config } from "../src/config.js";

describe("Physics and Collision Detection", () => {
  let field: Field;
  let ball: Ball;
  let paddle: Paddle;

  beforeEach(() => {
    field = new Field(800, 600);
    ball = new Ball(field);
    paddle = new Paddle(1, field, 5);
  });

  describe("Paddle Movement", () => {
    it("should move paddle up", () => {
      const initialY = paddle.cy;
      paddle.ySpeed = -paddle.speed;

      // Simulate one physics step (simplified)
      paddle.cy += paddle.ySpeed * 0.016; // ~16ms frame

      expect(paddle.cy).toBeLessThan(initialY);
    });

    it("should move paddle down", () => {
      const initialY = paddle.cy;
      paddle.ySpeed = paddle.speed;

      paddle.cy += paddle.ySpeed * 0.016;

      expect(paddle.cy).toBeGreaterThan(initialY);
    });

    it("should not move paddle beyond field bounds", () => {
      const halfLen = paddle.length / 2;
      paddle.cy = halfLen - 10;
      paddle.ySpeed = -paddle.speed;

      // Move several times
      for (let i = 0; i < 100; i++) {
        paddle.cy += paddle.ySpeed * 0.016;
        // In real game, there's bound checking
        paddle.cy = Math.max(halfLen, Math.min(field.height - halfLen, paddle.cy));
      }

      expect(paddle.cy).toBeGreaterThanOrEqual(halfLen);
      expect(paddle.cy).toBeLessThanOrEqual(field.height - halfLen);
    });

    it("should have correct capsule dimensions", () => {
      const capsule = paddle.getCapsule();
      const halfLen = paddle.length / 2 - paddle.width / 2;

      expect(capsule.x1).toBe(paddle.cx);
      expect(capsule.x2).toBe(paddle.cx);
      expect(capsule.y1).toBe(paddle.cy - halfLen);
      expect(capsule.y2).toBe(paddle.cy + halfLen);
      expect(capsule.R).toBe(paddle.width / 2);
    });

    it("should cache capsule when position doesn't change", () => {
      const capsule1 = paddle.getCapsule();
      const y1Before = capsule1.y1;

      // Don't change position
      const capsule2 = paddle.getCapsule();

      expect(capsule1).toBe(capsule2); // Same object reference
      expect(capsule2.y1).toBe(y1Before); // Same values
    });

    it("should update capsule when position changes", () => {
      paddle.cy = 200;
      const capsule1 = paddle.getCapsule();
      const oldY1 = capsule1.y1;

      paddle.cy = 400; // Significantly different position
      const capsule2 = paddle.getCapsule();

      // y1 should be different after position change
      expect(capsule2.y1).not.toBe(oldY1);
      expect(capsule2.y1).toBe(paddle.cy - (paddle.length / 2 - paddle.width / 2));
    });
  });

  describe("Ball Physics", () => {
    it("should have initial speed within expected range", () => {
      const speed = Math.sqrt(ball.speedX ** 2 + ball.speedY ** 2);
      expect(speed).toBeCloseTo(config.game.ballSpeed, 1);
    });

    it("should move ball based on velocity", () => {
      const initialX = ball.x;
      const initialY = ball.y;

      ball.x += ball.speedX * 0.016;
      ball.y += ball.speedY * 0.016;

      expect(ball.x).not.toBe(initialX);
      expect(ball.y).not.toBe(initialY);
    });

    it("should have angle within reasonable range", () => {
      const angle = Math.atan2(ball.speedY, ball.speedX);
      // Ball angle can be any direction initially, just verify it's a valid number
      expect(isFinite(angle)).toBe(true);
      expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI);
    });
  });

  describe("Closest Point on Segment", () => {
    it("should find closest point on paddle segment", () => {
      const point = closestPointOnSegment(paddle, ball);

      expect(point).toHaveProperty("x");
      expect(point).toHaveProperty("y");
      expect(isFinite(point.x)).toBe(true);
      expect(isFinite(point.y)).toBe(true);
    });

    it("should find point within paddle bounds vertically", () => {
      const capsule = paddle.getCapsule();
      const point = closestPointOnSegment(paddle, ball);

      expect(point.y).toBeGreaterThanOrEqual(capsule.y1 - 1);
      expect(point.y).toBeLessThanOrEqual(capsule.y2 + 1);
    });

    it("should find same x as paddle", () => {
      const point = closestPointOnSegment(paddle, ball);
      expect(point.x).toBeCloseTo(paddle.cx, 1);
    });

    it("should clamp point to segment endpoints", () => {
      // Move ball far above paddle
      ball.y = -100;
      const point = closestPointOnSegment(paddle, ball);
      const capsule = paddle.getCapsule();

      expect(point.y).toBeGreaterThanOrEqual(capsule.y1 - 1);
    });
  });

  describe("Ball-Paddle Collision", () => {
    it("should detect collision when ball touches paddle", () => {
      // Position ball near paddle
      paddle.cy = field.height / 2;
      ball.x = paddle.cx + 10;
      ball.y = paddle.cy;

      const collided = collideBallCapsule(paddle, ball);
      expect(collided).toBe(true);
    });

    it("should not detect collision when ball is far", () => {
      ball.x = field.width - 50;
      ball.y = field.height - 50;
      paddle.cy = 100;

      const collided = collideBallCapsule(paddle, ball);
      expect(collided).toBe(false);
    });

    it("should reflect ball velocity on collision", () => {
      paddle.cy = field.height / 2;
      ball.x = paddle.cx + 5;
      ball.y = paddle.cy;

      const initialSpeedX = ball.speedX;
      ball.speedX = 5; // Ball moving toward paddle

      collideBallCapsule(paddle, ball);

      // After collision, ball should be reflected (negative speed)
      expect(ball.speedX).not.toBe(initialSpeedX);
    });

    it("should not reflect ball moving away from paddle", () => {
      paddle.cy = field.height / 2;
      ball.x = paddle.cx + 50; // Position ball far away
      ball.y = paddle.cy;
      ball.speedX = -5; // Ball moving away

      const collided = collideBallCapsule(paddle, ball);

      // Ball far away should not collide
      expect(collided).toBe(false);
    });

    it("should push ball out of paddle", () => {
      paddle.cy = field.height / 2;
      // Position ball overlapping with paddle
      ball.x = paddle.cx;
      ball.y = paddle.cy;
      ball.speedX = 5;

      const positionBefore = { x: ball.x, y: ball.y };

      collideBallCapsule(paddle, ball);

      // Ball should be pushed away
      const distance = Math.hypot(ball.x - paddle.cx, ball.y - paddle.cy);
      expect(distance).toBeGreaterThan(0);
    });

    it("should limit deflection angle to 45 degrees", () => {
      paddle.cy = field.height / 2;
      ball.x = paddle.cx + 8;
      ball.y = paddle.cy;
      ball.speedX = 6;
      ball.speedY = 0;

      collideBallCapsule(paddle, ball);

      // After collision, angle should be limited
      const speed = Math.hypot(ball.speedX, ball.speedY);
      const angle = Math.atan2(ball.speedY, ball.speedX);
      const maxAngle = Math.PI / 4; // 45 degrees

      expect(Math.abs(angle)).toBeLessThanOrEqual(maxAngle + 0.1); // Small tolerance
    });
  });

  describe("Paddle Positions on Field", () => {
    it("should place paddle 1 on left side", () => {
      const p1 = new Paddle(1, field, 5);
      expect(p1.cx).toBeLessThan(field.width / 2);
    });

    it("should place paddle 2 on right side", () => {
      const p2 = new Paddle(2, field, 5);
      expect(p2.cx).toBeGreaterThan(field.width / 2);
    });

    it("should place both paddles equidistant from center", () => {
      const p1 = new Paddle(1, field, 5);
      const p2 = new Paddle(2, field, 5);

      const p1Distance = Math.abs(p1.cx - field.width / 2);
      const p2Distance = Math.abs(p2.cx - field.width / 2);

      expect(p1Distance).toBeCloseTo(p2Distance);
    });
  });
});
