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
    port: parsePort(process.env.PORT, 3002),
    host: getEnvVar("HOST", "::"),
    env: getEnvVar("NODE_ENV", "production"),
  },

  // Database configuration
  database: {
    path: getEnvVar("DATABASE_PATH", "src/database/database.db"),
  },

  // Auth service
  auth: {
    serviceUrl: getEnvVar("AUTH_SERVICE_URL", "http://databank:3000"),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL", "info"),
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
};
