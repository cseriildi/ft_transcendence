// Set test environment variables BEFORE any modules are imported
// This file is loaded first via setupFiles in vitest.config.ts

// Core required variables
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.PORT = process.env.PORT || "3000";
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ":memory:";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// Public server configuration
process.env.PUBLIC_HOST = process.env.PUBLIC_HOST || "localhost";
process.env.PUBLIC_PORT = process.env.PUBLIC_PORT || "8443";
process.env.PUBLIC_PROTOCOL = process.env.PUBLIC_PROTOCOL || "http";

// Route prefixes
process.env.AUTH_PREFIX = process.env.AUTH_PREFIX || "/auth";
process.env.OAUTH_PREFIX = process.env.OAUTH_PREFIX || "/oauth";
process.env.API_PREFIX = process.env.API_PREFIX || "/api";

// CORS configuration
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS || "http://localhost:8443,http://localhost:3000";

// JWT configuration
process.env.JWT_ISSUER = process.env.JWT_ISSUER || "test-issuer";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || "test-audience";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret-key";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-key";
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || "7d";

// Service-to-service authentication
process.env.SERVICE_SECRET = process.env.SERVICE_SECRET || "test-service-secret";

// OAuth configuration (optional - using getOptionalEnvVar in config)
process.env.OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "test-state-secret";
process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "test_github_client_id";
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "test_github_client_secret";
process.env.GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/oauth/github/callback";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test_google_client_id";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test_google_client_secret";
process.env.GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/google/callback";
