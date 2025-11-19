// Set test environment variables BEFORE any modules are imported
// This file is loaded first via setupFiles in vitest.config.ts

// Core required variables
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.PORT = process.env.PORT || "3002";
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ":memory:";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// CORS configuration
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS || "http://localhost:8443,http://localhost:3000";

// Service URLs
process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3000";

// Public host and ports (used to build default CORS origins in src/config.ts)
process.env.PUBLIC_HOST = process.env.PUBLIC_HOST || "localhost";
process.env.NGINX_HTTP_PORT = process.env.NGINX_HTTP_PORT || "8443";
process.env.FRONTEND_PORT = process.env.FRONTEND_PORT || "3000";
