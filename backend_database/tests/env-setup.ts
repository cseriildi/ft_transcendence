// Set test environment variables BEFORE any modules are imported
// This file is loaded first via setupFiles in vitest.config.ts

// Core required variables
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.PORT = process.env.PORT || "3000";
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ":memory:";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// JWT configuration
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-for-testing";
process.env.JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

// OAuth configuration
process.env.OAUTH_42_CLIENT_ID = process.env.OAUTH_42_CLIENT_ID || "test_42_client_id";
process.env.OAUTH_42_CLIENT_SECRET = process.env.OAUTH_42_CLIENT_SECRET || "test_42_client_secret";
process.env.OAUTH_42_CALLBACK_URL =
  process.env.OAUTH_42_CALLBACK_URL || "http://localhost:3000/api/auth/42/callback";

// Legacy GitHub OAuth (if still used)
if (!process.env.GITHUB_CLIENT_ID) {
  process.env.GITHUB_CLIENT_ID = "test_github_client_id";
}
if (!process.env.GITHUB_CLIENT_SECRET) {
  process.env.GITHUB_CLIENT_SECRET = "test_github_client_secret";
}
if (!process.env.GITHUB_REDIRECT_URI) {
  process.env.GITHUB_REDIRECT_URI = "http://localhost:3000/oauth/github/callback";
}

// CORS and URL configuration
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8443";
process.env.BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
