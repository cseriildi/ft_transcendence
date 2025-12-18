export const VALID_MODES = ["local", "ai", "remote", "friend", "tournament", "remoteTournament"];

// Helper function to get required environment variable
function getEnvVar(name: string): string {
  const value = process.env[name];
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
function parsePositiveInt(name: string, value: string | undefined): number {
  if (!value) {
    throw new Error(`❌ Required environment variable ${name} is not set`);
  }
  const parsed = parseInt(value, 10);
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
    host: getEnvVar("HOST"),
    env: getEnvVar("NODE_ENV"),
    publicHost: getEnvVar("PUBLIC_HOST"),
    publicPort: getOptionalEnvVar("PUBLIC_PORT", ""),
  },

  // Backend database service URL
  backendDatabase: {
    url: getOptionalEnvVar("BACKEND_DATABASE_URL", "http://databank:3000"),
    //TODO: Silas. belongs to authUtils.ts
    authPrefix: getOptionalEnvVar("AUTH_PREFIX", "/api/auth"),
    apiPrefix: getOptionalEnvVar("API_PREFIX", "/api"),
  },

  // Service authentication
  serviceAuth: {
    secret: getEnvVar("SERVICE_SECRET"),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL"),
  },

  // Game configuration
  game: {
    width: parsePositiveInt("GAME_WIDTH", process.env.GAME_WIDTH),
    height: parsePositiveInt("GAME_HEIGHT", process.env.GAME_HEIGHT),
    maxScore: parsePositiveInt("MAX_SCORE", process.env.MAX_SCORE),
    ballRadius: parsePositiveInt("BALL_RADIUS", process.env.BALL_RADIUS),
    ballSpeed: parsePositiveInt("BALL_SPEED", process.env.BALL_SPEED),
    paddleSpeed: parsePositiveInt("PADDLE_SPEED", process.env.PADDLE_SPEED),
    physicsFPS: parsePositiveInt("PHYSICS_FPS", process.env.PHYSICS_FPS),
    renderFPS: parsePositiveInt("RENDER_FPS", process.env.RENDER_FPS),
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
