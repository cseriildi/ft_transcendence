# Environment Variables Guide

This document describes all environment variables used across the Ping-Pong application services.

## 📁 File Structure

Each service should have its own `.env` file (not committed to git):

- `backend_database/.env` - Database service configuration
- `backend_gamelogic/.env` - Game logic service configuration
- `frontend/.env` - Frontend configuration

Use the `.env.example` files in each directory as templates.

---

## 🗄️ Backend Database Service

### Server Configuration

| Variable   | Default       | Description                                  |
| ---------- | ------------- | -------------------------------------------- |
| `PORT`     | `3000`        | Port for the database API server             |
| `HOST`     | `::`          | Host address (:: for IPv6, 0.0.0.0 for IPv4) |
| `NODE_ENV` | `development` | Environment (development/production)         |

### Database

| Variable        | Default                      | Description                  |
| --------------- | ---------------------------- | ---------------------------- |
| `DATABASE_PATH` | `./src/database/database.db` | Path to SQLite database file |

### Logging

| Variable    | Default | Description                           |
| ----------- | ------- | ------------------------------------- |
| `LOG_LEVEL` | `error` | Logging level (error/warn/info/debug) |

### JWT Authentication

| Variable             | Default                        | Description                   |
| -------------------- | ------------------------------ | ----------------------------- |
| `JWT_ACCESS_SECRET`  | `dev-access-secret-change-me`  | Secret for access tokens      |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-change-me` | Secret for refresh tokens     |
| `JWT_ACCESS_TTL`     | `15m`                          | Access token expiration time  |
| `JWT_REFRESH_TTL`    | `7d`                           | Refresh token expiration time |
| `JWT_ISSUER`         | `ping-pong-api`                | JWT issuer claim              |
| `JWT_AUDIENCE`       | `ping-pong-clients`            | JWT audience claim            |

### OAuth

| Variable               | Default                                       | Description                   |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| `OAUTH_STATE_SECRET`   | Falls back to refresh secret                  | Secret for OAuth state tokens |
| `GITHUB_CLIENT_ID`     | -                                             | GitHub OAuth client ID        |
| `GITHUB_CLIENT_SECRET` | -                                             | GitHub OAuth client secret    |
| `GITHUB_REDIRECT_URI`  | `http://localhost:3000/oauth/github/callback` | GitHub callback URL           |
| `GOOGLE_CLIENT_ID`     | -                                             | Google OAuth client ID        |
| `GOOGLE_CLIENT_SECRET` | -                                             | Google OAuth client secret    |
| `GOOGLE_REDIRECT_URI`  | `http://localhost:3000/oauth/google/callback` | Google callback URL           |

### Route Prefixes

| Variable       | Default  | Description             |
| -------------- | -------- | ----------------------- |
| `AUTH_PREFIX`  | `/auth`  | Prefix for auth routes  |
| `OAUTH_PREFIX` | `/oauth` | Prefix for OAuth routes |
| `API_PREFIX`   | `/api`   | Prefix for API routes   |

---

## 🎮 Backend Game Logic Service

### Server Configuration

| Variable   | Default       | Description                                  |
| ---------- | ------------- | -------------------------------------------- |
| `PORT`     | `3001`        | Port for the game server                     |
| `HOST`     | `::`          | Host address (:: for IPv6, 0.0.0.0 for IPv4) |
| `NODE_ENV` | `development` | Environment (development/production)         |

### Logging

| Variable    | Default | Description                           |
| ----------- | ------- | ------------------------------------- |
| `LOG_LEVEL` | `info`  | Logging level (error/warn/info/debug) |

### Game Configuration

| Variable       | Default | Description                                  |
| -------------- | ------- | -------------------------------------------- |
| `GAME_WIDTH`   | `4000`  | Game canvas width                            |
| `GAME_HEIGHT`  | `2000`  | Game canvas height                           |
| `BALL_RADIUS`  | `40`    | Ball radius                                  |
| `BALL_SPEED`   | `40`    | Ball movement speed                          |
| `PADDLE_SPEED` | `40`    | Paddle movement speed                        |
| `PHYSICS_FPS`  | `60`    | Physics update frequency (frames per second) |
| `RENDER_FPS`   | `30`    | Network update frequency (frames per second) |

---

## 🌐 Frontend Service (Future)

### API Configuration

| Variable        | Default                 | Description               |
| --------------- | ----------------------- | ------------------------- |
| `VITE_API_URL`  | `http://localhost:3000` | Backend database API URL  |
| `VITE_GAME_URL` | `ws://localhost:3001`   | Game server WebSocket URL |

---

## 🔒 Security Best Practices

### Development

- Use the `.env.example` files as templates
- Never commit `.env` files to version control
- Use weak secrets for development (already in examples)

### Production

- Generate strong, unique secrets for all secret values
- Use environment variables from your hosting platform
- Never use default values in production
- Rotate secrets regularly
- Use HTTPS/WSS URLs for all endpoints

### Generating Secrets

```bash
# Generate a secure random secret (Unix/Linux/macOS)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 📝 Docker Environment Variables

When running services in Docker, pass environment variables using:

```bash
# Using -e flag
docker run -e PORT=3000 -e NODE_ENV=production ...

# Using --env-file
docker run --env-file .env ...
```

Or in `docker-compose.yml`:

```yaml
services:
  database:
    environment:
      - PORT=3000
      - NODE_ENV=production
    # Or use env_file:
    env_file:
      - ./backend_database/.env
```

---

## 🔍 Validation

Both services validate their configuration on startup and will exit with an error if:

- Port is invalid or ≤ 0
- Required secrets are missing in production
- FPS values are ≤ 0 (game service)

Check the console output when starting services to see the active configuration.
