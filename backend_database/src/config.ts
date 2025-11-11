// Store configuration warnings to log after Fastify starts
const configWarnings: string[] = [];

// Decide strictness based on environment. We allow fallbacks in development
// (for local dev) but require explicit env vars in production containers.
const NODE_ENV = process.env.NODE_ENV || "production";
// Allow fallbacks in non-production environments (development, test). In production we
// treat any missing env that would require a fallback as a fatal error.
const isProduction = NODE_ENV === "production";

// Helper function to get required environment variable.
// - If running in development, missing vars will use the provided fallback and a warning
//   will be collected.
// - If running in production, missing vars (even when a fallback is provided) will
//   throw an error and prevent the container from starting.
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue !== undefined) {
    if (!isProduction) {
      configWarnings.push(
        `Environment variable ${name} not found, using fallback value: "${defaultValue}"`
      );
      return defaultValue;
    }
    // In production, fail fast.
    throw new Error(
      `❌ Required environment variable ${name} is not set. Refusing to use fallback in production mode.`
    );
  }
  if (!value) {
    // No value and no fallback provided -> always error (required)
    throw new Error(`❌ Required environment variable ${name} is not set`);
  }
  return value;
}

// Helper function to get optional environment variable.
// Behavior:
// - If defaultValue is a non-empty string and we're in development, we record a warning
//   and return the default.
// - If defaultValue is a non-empty string and we're in production, we throw so the
//   container won't start using a potentially insecure default.
// - If defaultValue is an empty string (the common pattern for true-optional vars),
//   we return the empty default silently.
function getOptionalEnvVar(name: string, defaultValue = ""): string {
  const value = process.env[name];
  if (!value && defaultValue !== "") {
    if (!isProduction) {
      configWarnings.push(
        `Environment variable ${name} not found, using fallback value: "${defaultValue}"`
      );
      return defaultValue;
    }
    // In production, treat a non-empty fallback as a misconfiguration and refuse to start.
    throw new Error(
      `❌ Optional environment variable ${name} is not set. Refusing to use fallback in production mode.`
    );
  }
  return value || defaultValue;
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
  const host = getEnvVar("PUBLIC_HOST", "localhost");
  const port = getOptionalEnvVar("PUBLIC_PORT", "");
  const protocol = getEnvVar("PUBLIC_PROTOCOL", "http");
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}://${host}${portSuffix}${path}`;
}

// Environment configuration
export const config = {
  // Server configuration
  server: {
    port: parsePort(process.env.PORT, 3000),
    host: getEnvVar("HOST", "::"),
    env: getEnvVar("NODE_ENV", "production"),
    publicHost: getEnvVar("PUBLIC_HOST", "localhost"),
    publicPort: getOptionalEnvVar("PUBLIC_PORT", ""),
  },

  // Database configuration
  database: {
    path: getEnvVar("DATABASE_PATH", "./src/database/database.db"),
  },

  // Logging
  logging: {
    level: getEnvVar("LOG_LEVEL", "info"),
  },

  // Route prefixes
  routes: {
    auth: getEnvVar("AUTH_PREFIX", "/auth"),
    oauth: getEnvVar("OAUTH_PREFIX", "/api/oauth"),
    api: getEnvVar("API_PREFIX", "/api"),
  },

  // CORS configuration
  cors: {
    origins: getOptionalEnvVar("CORS_ORIGINS", "http://localhost:4200")
      .split(",")
      .map((s) => s.trim()),
  },

  // JWT config
  jwt: {
    issuer: getEnvVar("JWT_ISSUER", "ping-pong-api"),
    audience: getEnvVar("JWT_AUDIENCE", "ping-pong-clients"),
    accessSecret: getEnvVar("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: getEnvVar("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessTtl: getEnvVar("JWT_ACCESS_TTL", "15m"),
    refreshTtl: getEnvVar("JWT_REFRESH_TTL", "7d"),
  },

  // OAuth config
  oauth: {
    // OAuth is optional functionality, so we allow empty defaults for all OAuth vars
    // In production, if OAuth is needed, these must be explicitly set
    stateSecret: getOptionalEnvVar(
      "OAUTH_STATE_SECRET",
      isProduction ? "" : "dev-oauth-state-secret-change-me"
    ),
    github: {
      clientId: getOptionalEnvVar("GITHUB_CLIENT_ID", ""),
      clientSecret: getOptionalEnvVar("GITHUB_CLIENT_SECRET", ""),
      redirectUri: getOptionalEnvVar(
        "GITHUB_REDIRECT_URI",
        isProduction ? "" : buildPublicUrl("/oauth/github/callback")
      ),
    },
    google: {
      clientId: getOptionalEnvVar("GOOGLE_CLIENT_ID", ""),
      clientSecret: getOptionalEnvVar("GOOGLE_CLIENT_SECRET", ""),
      redirectUri: getOptionalEnvVar(
        "GOOGLE_REDIRECT_URI",
        isProduction ? "" : buildPublicUrl("/oauth/google/callback")
      ),
    },
  },
} as const;
