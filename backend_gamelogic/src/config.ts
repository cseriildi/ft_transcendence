// Game Configuration
export const GAME_CONFIG = {
  width: Number(process.env.GAME_WIDTH) || 4000,
  height: Number(process.env.GAME_HEIGHT) || 2000,
  ballRadius: Number(process.env.BALL_RADIUS) || 40,
  ballSpeed: Number(process.env.BALL_SPEED) || 40,
  paddleSpeed: Number(process.env.PADDLE_SPEED) || 40,
  physicsFPS: Number(process.env.PHYSICS_FPS) || 60,
  renderFPS: Number(process.env.RENDER_FPS) || 30,
};

export const PHYSICS_INTERVAL = 1000 / GAME_CONFIG.physicsFPS;
export const RENDER_INTERVAL = 1000 / GAME_CONFIG.renderFPS;

console.log('🎮 Game Configuration:', GAME_CONFIG);
console.log(`⚡ Physics: ${GAME_CONFIG.physicsFPS} FPS (${PHYSICS_INTERVAL.toFixed(2)}ms)`);
console.log(`📡 Network: ${GAME_CONFIG.renderFPS} FPS (${RENDER_INTERVAL.toFixed(2)}ms)`);