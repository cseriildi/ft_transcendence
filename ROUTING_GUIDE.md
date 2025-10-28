# Routing Guide

## Overview
All API routes are under the `/api` namespace for consistency and organization.

## Route Structure

### Backend Routes (databank:3000)
- **Auth Routes**: `/api/auth/*`
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `POST /api/auth/logout` - User logout
  - `POST /api/auth/refresh` - Refresh access token
  - `GET /api/auth/verify` - Verify token

- **OAuth Routes**: `/api/oauth/*`
  - `GET /api/oauth/github` - GitHub OAuth initiation
  - `GET /api/oauth/github/callback` - GitHub OAuth callback
  - `GET /api/oauth/google` - Google OAuth initiation
  - `GET /api/oauth/google/callback` - Google OAuth callback

- **User Routes**: `/api/users/*`
  - `GET /api/users` - List all users
  - `GET /api/users/:id` - Get user by ID
  - `PATCH /api/users/:id/email` - Update email
  - `PATCH /api/users/:id/username` - Update username
  - `PATCH /api/users/:id/heartbeat` - Update last seen
  - `POST /api/users/avatar` - Upload avatar

- **Match Routes**: `/api/matches/*`
- **Friend Routes**: `/api/friends/*`

### Game Routes (backend:3001)
- `GET /health` - Health check
- `GET /game` - WebSocket connection for game

## nginx Proxy Configuration

### Primary Routes
```nginx
location /api/ {
    proxy_pass http://databank:3000/api/;
}
```

### Backward Compatibility Routes
For CI tests and legacy integrations:
```nginx
location /auth/ {
    proxy_pass http://databank:3000/api/auth/;
}

location /oauth/ {
    proxy_pass http://databank:3000/api/oauth/;
}
```

Both `/auth/register` and `/api/auth/register` work, proxied to same backend route.

## Environment Variables

### Route Prefix Configuration
Set in `.env` file (copy from `.env.example`):
```bash
AUTH_PREFIX=/api/auth
OAUTH_PREFIX=/api/oauth
API_PREFIX=/api
```

**Important**: 
- These values must match the actual route registration in the backend!
- The `.env` file is gitignored - always check `.env.example` for correct defaults
- After changing .env, restart services: `docker compose up -d --force-recreate databank`

## Frontend Configuration

Frontend uses `API_URL` from environment:
```javascript
const config = {
  apiUrl: "https://localhost:8443/api",  // Injected at runtime
  wsUrl: "wss://localhost:8443/ws"
};
```

Frontend makes calls like:
```javascript
fetch(`${config.apiUrl}/auth/register`)  // https://localhost:8443/api/auth/register
```

## Testing

### Unit Tests
Tests use config values:
```typescript
const OAUTH_PREFIX = config.routes.oauth  // /api/oauth
const AUTH_PREFIX = config.routes.auth    // /api/auth
const API_PREFIX = config.routes.api      // /api
```

### Integration Tests (CI)
CI tests can use either:
- Modern: `https://localhost/api/auth/register`
- Legacy: `https://localhost/auth/register` (both work)

## Common Issues

### 404 Errors
If you get 404 errors:
1. Check `.env` file has correct prefixes (`/api/auth`, not `/auth`)
2. Restart services: `docker compose up -d --force-recreate`
3. Verify backend logs show: `routePrefixes: { auth: '/api/auth', oauth: '/api/oauth', api: '/api' }`

### Route Mismatch
Environment variables in `.env` override code defaults. Always keep them in sync!

## Architecture Diagram

```
Browser Request: https://localhost:8443/api/auth/register
       ↓
    nginx:443
       ↓
    Proxy to: http://databank:3000/api/auth/register
       ↓
    Backend Route: authRoutes with prefix '/api/auth'
       ↓
    Handler: POST /register (under /api/auth prefix)
       ↓
    Final route: /api/auth/register ✅
```
