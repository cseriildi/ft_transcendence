import { describe, it, expect } from 'vitest';
import { config } from '../src/config.js';

describe('Game Configuration', () => {
  it('should have valid default configuration', () => {
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.server.host).toBeDefined();
    expect(config.game.physicsFPS).toBeGreaterThan(0);
    expect(config.game.renderFPS).toBeGreaterThan(0);
  });

  it('should have valid game dimensions', () => {
    expect(config.game.width).toBeGreaterThan(0);
    expect(config.game.height).toBeGreaterThan(0);
    expect(config.game.ballRadius).toBeGreaterThan(0);
  });

  it('should have valid game physics settings', () => {
    expect(config.game.ballSpeed).toBeGreaterThan(0);
    expect(config.game.paddleSpeed).toBeGreaterThan(0);
  });
});
