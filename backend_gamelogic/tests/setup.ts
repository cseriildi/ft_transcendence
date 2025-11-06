// Test setup file
// This file runs before all tests

import { beforeAll, afterAll } from "vitest";

// Set test environment variables BEFORE any modules are imported
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.PORT = process.env.PORT || "3001";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// Game configuration
process.env.GAME_WIDTH = process.env.GAME_WIDTH || "4000";
process.env.GAME_HEIGHT = process.env.GAME_HEIGHT || "2000";
process.env.MAX_SCORE = process.env.MAX_SCORE || "10";
process.env.BALL_RADIUS = process.env.BALL_RADIUS || "40";
process.env.BALL_SPEED = process.env.BALL_SPEED || "40";
process.env.PADDLE_SPEED = process.env.PADDLE_SPEED || "40";
process.env.PHYSICS_FPS = process.env.PHYSICS_FPS || "60";
process.env.RENDER_FPS = process.env.RENDER_FPS || "30";

beforeAll(() => {
  // Global setup if needed
});

afterAll(() => {
  // Global cleanup if needed
});
