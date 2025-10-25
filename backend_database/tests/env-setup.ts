// Set test environment variables BEFORE any modules are imported
// This file is loaded first via setupFiles in vitest.config.ts

if (!process.env.GITHUB_CLIENT_ID) {
  process.env.GITHUB_CLIENT_ID = "test_client_id";
}
if (!process.env.GITHUB_CLIENT_SECRET) {
  process.env.GITHUB_CLIENT_SECRET = "test_client_secret";
}
if (!process.env.GITHUB_REDIRECT_URI) {
  process.env.GITHUB_REDIRECT_URI =
    "http://localhost:3000/oauth/github/callback";
}
