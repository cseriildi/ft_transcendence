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
};

// Validate configuration and log startup info
export const validateConfig = () => {
  console.log("🚀 Starting server with configuration:", {
    port: config.server.port,
    host: config.server.host,
    env: config.server.env,
    databasePath: config.database.path,
    logLevel: config.logging.level,
  });

  // Validate port is a valid number
  if (isNaN(config.server.port) || config.server.port <= 0) {
    console.error("❌ Invalid PORT environment variable");
    process.exit(1);
  }
};