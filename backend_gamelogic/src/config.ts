// Helper function to get required environment variable
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`❌ Required environment variable ${name} is not set`);
  }
  return value;
}

// Helper function to get optional environment variable
function getOptionalEnvVar(name: string, defaultValue: string = ""): string {
  return process.env[name] || defaultValue;
}

// Helper function to parse integer with validation
function parsePort(value: string | undefined, defaultValue: number): number {
  const port = parseInt(value || String(defaultValue), 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`❌ Invalid PORT: ${value}. Must be between 1 and 65535`);
  }
  return port;
}

// Helper function to parse positive integer with validation
function parsePositiveInt(name: string, value: string | undefined, defaultValue: number): number {
  const parsed = parseInt(value || String(defaultValue), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`❌ Invalid ${name}: ${value}. Must be a positive integer`);
  }
  return parsed;
}

// Environment configuration for game logic service
export const config = {
  // Server configuration
  server: {
    port: parsePort(process.env.PORT, 3001),
    host: getEnvVar("HOST", "::"),
    env: getEnvVar("NODE_ENV", "production"),
    publicHost: getEnvVar("PUBLIC_HOST", "localhost"),
    publicPort: getOptionalEnvVar("PUBLIC_PORT", ""),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL", "info"),
  },

  // Game configuration
  game: {
    width: parsePositiveInt("GAME_WIDTH", process.env.GAME_WIDTH, 3200),
    height: parsePositiveInt("GAME_HEIGHT", process.env.GAME_HEIGHT, 2000),
    maxScore: parsePositiveInt("MAX_SCORE", process.env.MAX_SCORE, 10),
    ballRadius: parsePositiveInt("BALL_RADIUS", process.env.BALL_RADIUS, 40),
    ballSpeed: parsePositiveInt("BALL_SPEED", process.env.BALL_SPEED, 40),
    paddleSpeed: parsePositiveInt("PADDLE_SPEED", process.env.PADDLE_SPEED, 40),
    physicsFPS: parsePositiveInt("PHYSICS_FPS", process.env.PHYSICS_FPS, 60),
    renderFPS: parsePositiveInt("RENDER_FPS", process.env.RENDER_FPS, 30),
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
};
