// Environment configuration
export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: process.env.HOST || "::",
    env: process.env.NODE_ENV || "development",
  },

  // Database configuration
  database: {
    path: process.env.DATABASE_PATH || "./src/database/database.db",
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "error",
  },

  // Route prefixes
  routes: {
    auth: process.env.AUTH_PREFIX || "/auth",
    oauth: process.env.OAUTH_PREFIX || "/oauth",
    api: process.env.API_PREFIX || "/api",
  },

  // JWT config
  jwt: {
    issuer: process.env.JWT_ISSUER || "ping-pong-api",
    audience: process.env.JWT_AUDIENCE || "ping-pong-clients",
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL || "7d",
  },

  // OAuth config
  oauth: {
    stateSecret: process.env.OAUTH_STATE_SECRET || process.env.JWT_REFRESH_SECRET || "dev-oauth-state-secret-change-me",
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      redirectUri: process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/oauth/github/callback",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/google/callback",
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

  // Validate port is a valid number
  if (isNaN(config.server.port) || config.server.port <= 0) {
    console.error("❌ Invalid PORT environment variable");
    process.exit(1);
  }
};
