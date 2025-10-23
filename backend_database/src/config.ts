// Helper function to get required environment variable
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`❌ Required environment variable ${name} is not set`);
  }
  return value;
}

// Helper function to parse integer with validation
function parsePort(value: string | undefined, defaultValue: number): number {
  const port = parseInt(value || String(defaultValue), 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`❌ Invalid PORT: ${value}. Must be between 1 and 65535`);
  }
  return port;
}

// Environment configuration
export const config = {
  // Server configuration
  server: {
    port: parsePort(process.env.PORT, 3000),
    host: getEnvVar("HOST", "::"),
    env: getEnvVar("NODE_ENV", "production"),
  },

  // Database configuration
  database: {
    path: getEnvVar("DATABASE_PATH", "/app/data/database.db"),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL", "info"),
  },

  // Route prefixes
  routes: {
    auth: getEnvVar("AUTH_PREFIX", "/auth"),
    oauth: getEnvVar("OAUTH_PREFIX", "/oauth"),
    api: getEnvVar("API_PREFIX", "/api"),
  },

  // JWT config
  jwt: {
    issuer: getEnvVar("JWT_ISSUER", "ping-pong-api"),
    audience: getEnvVar("JWT_AUDIENCE", "ping-pong-clients"),
    accessSecret: getEnvVar("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: getEnvVar(
      "JWT_REFRESH_SECRET",
      "dev-refresh-secret-change-me"
    ),
    accessTtl: getEnvVar("JWT_ACCESS_TTL", "15m"),
    refreshTtl: getEnvVar("JWT_REFRESH_TTL", "7d"),
  },

  // OAuth config
  oauth: {
    stateSecret: getEnvVar(
      "OAUTH_STATE_SECRET",
      process.env.JWT_REFRESH_SECRET || "dev-oauth-state-secret-change-me"
    ),
    github: {
      clientId: getEnvVar("GITHUB_CLIENT_ID", ""),
      clientSecret: getEnvVar("GITHUB_CLIENT_SECRET", ""),
      redirectUri: getEnvVar(
        "GITHUB_REDIRECT_URI",
        "http://localhost:3000/oauth/github/callback"
      ),
    },
    google: {
      clientId: getEnvVar("GOOGLE_CLIENT_ID", ""),
      clientSecret: getEnvVar("GOOGLE_CLIENT_SECRET", ""),
      redirectUri: getEnvVar(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:3000/oauth/google/callback"
      ),
    },
  },
} as const;

// Validate configuration and log startup info
export const validateConfig = () => {
  console.log("🚀 Starting server with configuration:", {
    port: config.server.port,
    host: config.server.host,
    env: config.server.env,
    databasePath: config.database.path,
    logLevel: config.logging.level,
    routePrefixes: config.routes,
  });
};
