// Helper function to get required environment variable
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ Required environment variable ${name} is not set`);
  }
  return value;
}

// Helper function to get optional environment variable
function getOptionalEnvVar(name: string, defaultValue = ""): string {
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

// Helper to build public URL
function buildPublicUrl(path: string): string {
  const host = getEnvVar("PUBLIC_HOST");
  const port = getOptionalEnvVar("PUBLIC_PORT", "");
  const protocol = getEnvVar("PUBLIC_PROTOCOL");
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}://${host}${portSuffix}${path}`;
}

// Environment configuration
export const config = {
  // Server configuration
  server: {
    port: parsePort(process.env.PORT, 3000),
    host: getEnvVar("HOST"),
    env: getEnvVar("NODE_ENV"),
    publicHost: getEnvVar("PUBLIC_HOST"),
    publicPort: getOptionalEnvVar("PUBLIC_PORT", ""),
  },

  // Database configuration
  database: {
    path: getEnvVar("DATABASE_PATH"),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL"),
  },

  // Route prefixes
  routes: {
    auth: getEnvVar("AUTH_PREFIX"),
    oauth: getEnvVar("OAUTH_PREFIX"),
    api: getEnvVar("API_PREFIX"),
  },

  // CORS configuration
  cors: {
    origins: getEnvVar("CORS_ORIGINS")
      .split(",")
      .map((s) => s.trim()),
  },

  // JWT config
  jwt: {
    issuer: getEnvVar("JWT_ISSUER"),
    audience: getEnvVar("JWT_AUDIENCE"),
    accessSecret: getEnvVar("JWT_ACCESS_SECRET"),
    refreshSecret: getEnvVar("JWT_REFRESH_SECRET"),
    accessTtl: getEnvVar("JWT_ACCESS_TTL"),
    refreshTtl: getEnvVar("JWT_REFRESH_TTL"),
  },

  // OAuth config
  oauth: {
    // OAuth is optional functionality
    stateSecret: getOptionalEnvVar("OAUTH_STATE_SECRET", ""),
    github: {
      clientId: getOptionalEnvVar("GITHUB_CLIENT_ID", ""),
      clientSecret: getOptionalEnvVar("GITHUB_CLIENT_SECRET", ""),
      redirectUri: getOptionalEnvVar("GITHUB_REDIRECT_URI", ""),
    },
    google: {
      clientId: getOptionalEnvVar("GOOGLE_CLIENT_ID", ""),
      clientSecret: getOptionalEnvVar("GOOGLE_CLIENT_SECRET", ""),
      redirectUri: getOptionalEnvVar("GOOGLE_REDIRECT_URI", ""),
    },
  },
} as const;

// Validate configuration and log startup info
export const validateConfig = () => {
  // Configuration is logged by Fastify on startup
  // No need for console.log here
};
