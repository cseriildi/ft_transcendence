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

// Detect if running in Docker by checking for Docker-specific env or hostname patterns
function isRunningInDocker(): boolean {
  return (
    process.env.DOCKER_CONTAINER === "true" ||
    process.env.NODE_ENV === "production"
  );
}

// Context-aware defaults based on environment
const isDocker = isRunningInDocker();

// Environment configuration
export const config = {
  // Server configuration
  server: {
    port: parsePort(process.env.PORT, 3002),
    host: getEnvVar("HOST"),
    env: getEnvVar("NODE_ENV"),
  },

  // Database configuration
  database: {
    path: getEnvVar("DATABASE_PATH"),
  },

  // Auth service
  auth: {
    serviceUrl: getEnvVar("AUTH_SERVICE_URL"),
  },

  // CORS configuration
  cors: {
    origins: getEnvVar("CORS_ORIGINS")
      .split(",")
      .map((s) => s.trim()),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL"),
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
