// Environment configuration for game logic service
export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || "3001"),
    host: process.env.HOST || "::",
    env: process.env.NODE_ENV || "development",
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },

  // Game configuration
  game: {
    width: parseInt(process.env.GAME_WIDTH || "4000"),
    height: parseInt(process.env.GAME_HEIGHT || "2000"),
    ballRadius: parseInt(process.env.BALL_RADIUS || "40"),
    ballSpeed: parseInt(process.env.BALL_SPEED || "40"),
    paddleSpeed: parseInt(process.env.PADDLE_SPEED || "40"),
    physicsFPS: parseInt(process.env.PHYSICS_FPS || "60"),
    renderFPS: parseInt(process.env.RENDER_FPS || "30"),
  },
} as const;

// Derived constants
export const PHYSICS_INTERVAL = 1000 / config.game.physicsFPS;
export const RENDER_INTERVAL = 1000 / config.game.renderFPS;

// Validate configuration and log startup info
export const validateConfig = () => {
  console.log("🎮 Starting game server with configuration:", {
    port: config.server.port,
    host: config.server.host,
    env: config.server.env,
    logLevel: config.logging.level,
    gameSettings: config.game,
  });

  console.log(`⚡ Physics: ${config.game.physicsFPS} FPS (${PHYSICS_INTERVAL.toFixed(2)}ms)`);
  console.log(`📡 Network: ${config.game.renderFPS} FPS (${RENDER_INTERVAL.toFixed(2)}ms)`);

  // Validate port is a valid number
  if (isNaN(config.server.port) || config.server.port <= 0) {
    console.error("❌ Invalid PORT environment variable");
    process.exit(1);
  }

  // Validate game settings
  if (config.game.physicsFPS <= 0 || config.game.renderFPS <= 0) {
    console.error("❌ Invalid FPS configuration");
    process.exit(1);
  }
};