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

  // CORS configuration
  cors: {
    origins: getOptionalEnvVar(
      "CORS_ORIGINS",
      `http://${getEnvVar("PUBLIC_HOST", "localhost")}:${getEnvVar(
        "NGINX_HTTP_PORT",
        "8080"
      )},http://${getEnvVar("PUBLIC_HOST", "localhost")}:${getEnvVar(
        "FRONTEND_PORT",
        "4200"
      )}`
    )
      .split(",")
      .map((s) => s.trim()),
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
