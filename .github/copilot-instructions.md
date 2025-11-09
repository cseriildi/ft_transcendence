# Copilot Instructions - ft_transcendence

A multi-service web application for a Pong game with real-time gameplay, user authentication (including OAuth), and match history.

## Architecture Overview

**Gateway-based microarchitecture** deployed via Docker Compose:

- **Gateway/Proxy config**: Update `ops/nginx.conf` for routing changes, restart nginx service
- **databank** (`backend_database/`): Fastify + SQLite API service (internal port 3000)
- **backend** (`backend_gamelogic/`): WebSocket game server (internal port 3001)
- **frontend**: TypeScript SPA with Tailwind CSS (internal port 4200)
- **live-chat** (`live-chat/`): WebSocket chat service (internal port 3002)

**Unified HTTPS Access:**

- All traffic routes through Nginx gateway at `https://localhost:8443`
- SSL termination handled by proxy using self-signed certificates
- Backend services hidden from external access (no direct port exposure)

Services communicate across Docker network `transcendence`. All client access goes through the gateway for security and unified SSL.

## Key Development Patterns

### Service-Based Architecture

Each service follows consistent structure:

```
src/
  main.ts|server.ts     # Entry point with plugin registration
  config.ts             # Environment-based config with validation
  plugins/              # Fastify plugins (error handlers, etc.)
  utils/                # Shared utilities
  services/             # Feature-based modules (database service only)
  tests/                # Vitest test suites
```

### Database Service Patterns (`backend_database/`)

**Service Organization**: Features organized in `services/` with MVC pattern:

- `services/userService/`: userController.ts, userRoutes.ts, userTypes.ts, userSchemas.ts
- Similar structure for `authService/`, `matchService/`, `oAuthService/`, `2FAService/`

**Controller Pattern**: Use `createHandler` wrapper for type safety and error handling:

```typescript
const getUserById = createHandler<{ Params: UserParams }, GetUserResponse>(
  async (request, { db }) => {
    // Validation, business logic, database operations
    return ApiResponseHelper.success(data, "message");
  },
);
```

**Database Access**: Promisified SQLite callbacks via `db.get()`, `db.all()`, `db.run()`:

```typescript
const user = await db.get<User>("SELECT * FROM users WHERE id = ?", [id]);
```

**Error Handling**: Throw typed errors, global handler formats responses:

```typescript
throw errors.notFound("User"); // 404
throw errors.validation("message"); // 400
throw errors.forbidden("reason"); // 403
```

### Game Service Patterns (`backend_gamelogic/`)

**WebSocket-First**: Real-time game state via WebSocket at `/game`

- Clients stored in `game.clients` Set
- Message-based communication (`playerInput`, `joinGame`)
- Broadcast functions: `broadcastGameState()`, `broadcastGameSetup()`

### Live Chat Service Patterns (`live-chat/`)

**Unified WebSocket Endpoint**: Single WebSocket connection at `/ws` with action-based routing

- **Actions**: `join_lobby`, `leave_lobby`, `join_chat`, `leave_chat`, `send_message`
- **State Management**: In-memory Maps/Sets for rooms, connections, ban lists, chat history
- **Blocking**: HTTP POST `/lobby/block` endpoint (requires active lobby connection)
- **Message Types**: `lobby_connected`, `chat_connected`, `message`, `system`, `error`
- **Authentication**: Query params (userId, username) + optional Bearer token support
- **Database**: SQLite for persistent block storage, promisified queries
- **Chat History**: Last 20 messages per room, sent on join
- **Connection Cleanup**: Automatic cleanup on disconnect from lobby and all chat rooms

**Key Files**:

- `src/routes/websocket.routes.ts`: WebSocket setup and action routing
- `src/handlers/lobby.handler.ts`: Lobby join/leave/cleanup logic
- `src/handlers/chat.handler.ts`: Chat join/leave/messaging logic
- `src/services/state.ts`: Centralized in-memory state management
- `src/www/unified-ws-client.html`: Test client for WebSocket functionality

### Frontend Patterns

**SPA Router**: Custom router in `router/Router.ts` manages client-side navigation
**Page Initialization**: Each route has init function (initHomePage, initPongPage, etc.)
**WebSocket Integration**: `Pong.ts` class handles game canvas and WebSocket connection

## Development Workflow

### Local Development

```bash
# Generate SSL certificates (required)
chmod +x ./scripts/certs.sh && ./scripts/certs.sh

# Start all services
docker compose up -d --build

# Individual service development (inside containers)
npm run dev    # Hot reload via tsx
npm run test   # Vitest test runner
```

## DevOps & Infrastructure

### Containerization Strategy

**Multi-Service Architecture**: Each service has its own Dockerfile with service-specific optimizations:

- **Database Service**: Uses `tsx` for hot reload in development, SQLite Alpine package
- **Game Service**: Production builds with TypeScript compilation, proper multi-stage potential
- **Frontend**: Browser-sync for local development with Tailwind CSS compilation

**Current Container Issues**:

- Frontend uses `node:latest` (should pin version)
- No multi-stage builds for production optimization
- Missing health checks and proper signal handling
- Database service bypasses build step in development

### Certificate Management

**Development Certificates**: `scripts/certs.sh` generates self-signed certificates

```bash
# Certificate generation with custom config
CERT_DIR=.certs CN=localhost.localdomain DAYS=825 ./scripts/certs.sh

# Configuration in ops/openssl/dev.cnf with SAN support
# Includes localhost, 127.0.0.1, ::1 for local development
```

**Certificate Paths**:

- `.certs/cert.pem` - SSL certificate
- `.certs/key.pem` - Private key
- `.certs/rootCA.pem` - Root CA (copy of cert for trust)

### Service Communication & Networking

**Docker Network**: `transcendence` bridge network isolates services
**Port Mapping**:

- Nginx Gateway: 8443 (HTTPS only - all external access)
- Frontend: 4200 (internal only)
- Database API: 3000 (internal only)
- Game Server: 3001 (internal only)
- Live Chat: 3002 (internal only)

**Infrastructure:**

- ✅ Nginx reverse proxy with SSL termination on port 8443
- ✅ Backend services hidden behind gateway (no direct port exposure)
- ✅ Health check endpoints available (database, live-chat services)
- ❌ No automatic HTTP→HTTPS redirects (only HTTPS on 8443)
- ❌ No HTTP port 80 listener
- ❌ No load balancing (single instance per service)
- ❌ No service discovery
- ❌ No Docker health checks configured in docker-compose.yml

### Environment Management

**Environment Files**: `.env.example` templates for each service

```bash
# Root level environment
APP_NAME=ft_transcendence
PUBLIC_API_URL=http://localhost.localdomain/api
PUBLIC_WS_URL=ws://localhost.localdomain/ws
TLS_CERT_PATH=./.certs/cert.pem
```

**Note**: Configuration uses `localhost.localdomain` for local development (matches nginx server_name).

### CI/CD Pipeline

**Current State**: Minimal GitHub Actions setup

- `secrets.yml` workflow prevents `.env` file commits
- No build/test/deploy pipelines
- No image building or registry pushing
- No automated testing on PR/push

### Volume Management

**Persistent Data**: Database volume mapping

```yaml
# docker-compose.yml
volumes:
  - ./backend_database/database:/app/data # SQLite persistence
```

### Testing Strategy

- **In-memory SQLite** for database tests (`:memory:` path)
- **Test helpers** in `tests/setup.ts`: `createTestApp()`, `resetDatabase()`
- **Vitest config** with globals, coverage, and env setup
- **OAuth testing** via `test-oauth.sh` script

### Service URLs

- **Application**: https://localhost:8443 (unified HTTPS entry point)
- Frontend routes: `https://localhost:8443/` (static files)
- API routes: `https://localhost:8443/api/*`, `https://localhost:8443/auth/*`, `https://localhost:8443/oauth/*`
- WebSocket (game): `wss://localhost:8443/ws/game`
- WebSocket (chat): `wss://localhost:8443/ws/chat`
- Chat HTTP endpoints: `https://localhost:8443/chat/*` (health, ready, lobby/block)
- No HTTP listener on port 80 (HTTPS only)

## Configuration & Environment

**Environment Variables**: Each service uses `config.ts` with validation on startup

- Database service: `PORT`, `HOST`, `NODE_ENV`, `DATABASE_PATH`, JWT secrets, OAuth keys
- Game service: `PORT`, `HOST`, `NODE_ENV`, `LOG_LEVEL`
- Live chat service: `PORT`, `HOST`, `NODE_ENV`, `DATABASE_PATH`, `LOG_LEVEL`

**Docker Volumes**: Database persistence via `./backend_database/database:/app/data`

## Authentication & Security

**JWT-based auth** with access/refresh token pattern:

- OAuth 2.0 flow with GitHub integration (`oAuthService/`)
- 2FA support via TOTP (`2FAService/`)
- Middleware auth protection (`middleware/authMiddleware.ts`)
- CORS configured for frontend origin

**Security headers**: Rate limiting, cookie-based state management for OAuth

## Key Files for Understanding

- `docker-compose.yml`: Service orchestration and networking
- `backend_database/src/main.ts`: Plugin registration order and app setup
- `backend_database/src/routes/index.ts`: API route structure
- `backend_gamelogic/src/server.ts`: WebSocket game server setup
- `frontend/src/ts/main.ts`: SPA initialization and routing
- Test files demonstrate service integration patterns

## Common Tasks

**Adding new API endpoint**: Create in appropriate service folder (controller → routes → types → schemas)
**Database schema changes**: Update `src/database.ts` initialization
**New game features**: Modify `gameUtils.ts` and WebSocket message handlers
**Frontend routes**: Add to router and create init function in `main.ts`

## DevOps Common Tasks

**Container rebuilds**: `docker compose up -d --build` after Dockerfile changes
**Service logs**: `docker compose logs -f [service]` for debugging
**Certificate renewal**: Re-run `./scripts/certs.sh` with `FORCE=true`
**Database backup**: Copy `./backend_database/database/database.db` before schema changes
**Service scaling**: Add replicas to `docker-compose.yml` (requires load balancer)
**Environment updates**: Update `.env.example` files and restart containers

## Production Considerations

**Security**: Services protected behind Nginx reverse proxy, no direct external access to backend ports
**SSL/TLS**: SSL termination handled by Nginx gateway, development certificates suitable for local development
**Monitoring**: No health checks, metrics collection, or observability
**Deployment**: No automated deployment pipeline or rollback strategy
**Scaling**: No horizontal scaling capability without reverse proxy

## Known Documentation Issues

**README.md Outdated**: The main `README.md` shows direct service access URLs (`http://localhost:4200`, `http://localhost:3000`, `http://localhost:3001`) which are incorrect. All access should go through the Nginx gateway at `https://localhost:8443`. Backend services are not exposed on host ports in the current `docker-compose.yml` configuration.
