# Copilot Instructions - Fastify TypeScript Backend

This is a production-ready Fastify-based TypeScript backend with SQLite database, JWT authentication, OAuth integration (GitHub), 2FA support, and comprehensive API documentation via Swagger.

## Architecture Overview

- **Entry Point**: `src/main.ts` registers plugins in order: CORS → Swagger (dev) → rate limiting → database → error handler → cookie → multipart → static files → routes
- **Plugin Pattern**: Uses Fastify plugins (`fp()`) for database connector and error handler
- **Database**: SQLite with promisified callback pattern via `DatabaseHelper` utility class
- **Type Safety**: Comprehensive TypeScript types in `src/types/` with strict typing across all services
- **Service-Based Architecture**: Each feature is a self-contained service with its own controller, routes, types, and schemas

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── config.ts                  # Centralized configuration with env validation
├── database.ts                # Database plugin with schema initialization
├── middleware/
│   └── authMiddleware.ts      # JWT authentication middleware (requireAuth, optionalAuth)
├── plugins/
│   └── errorHandlerPlugin.ts  # Global error handler for AppError instances
├── routes/
│   ├── index.ts               # Route registry (registers all service routes)
│   ├── healthRoutes.ts        # Health check endpoints
│   └── monitoringSchema.ts    # Health monitoring schemas
├── services/
│   ├── authService/           # Local authentication (register, login, refresh)
│   ├── oAuthService/          # OAuth providers (GitHub, Google)
│   ├── 2FAService/            # Two-factor authentication (TOTP)
│   ├── userService/           # User profile management & avatar uploads
│   ├── matchService/          # Match recording and statistics
│   └── friendService/         # Friend requests and relationships
├── types/
│   ├── commonTypes.ts         # Shared types (User, ApiResponse, etc.)
│   └── fastifyTypes.ts        # Fastify augmentations (request.user, request.server.db)
└── utils/
    ├── errorUtils.ts          # AppError class and error factory functions
    ├── responseUtils.ts       # ApiResponseHelper for consistent responses
    ├── handlerUtils.ts        # createHandler wrapper for DI pattern
    ├── authUtils.ts           # JWT signing/verification, token management
    ├── oauthUtils.ts          # OAuth state generation and validation
    ├── databaseUtils.ts       # DatabaseHelper wrapper for promisified queries
    ├── schemaUtils.ts         # Shared schema definitions
    └── uploadUtils.ts         # File upload handling (avatars)
```

## Key Patterns

### Service Structure

Each service follows this pattern:

- `*Types.ts` - TypeScript interfaces for requests/responses
- `*Schemas.ts` - JSON schemas for validation and Swagger documentation
- `*Controller.ts` - Business logic using `createHandler` wrapper
- `*Routes.ts` - Route registration with schema definitions and middleware

### Database Access

Use `DatabaseHelper` via `createHandler` for automatic dependency injection:

```typescript
import { createHandler } from "../../utils/handlerUtils.ts";

export const userController = {
  getUser: createHandler<{ Params: { id: string } }>(
    async (request, { db }) => {
      // db is DatabaseHelper with promisified methods
      const user = await db.get<User>(
        "SELECT id, username, email FROM users WHERE id = ?",
        [request.params.id]
      );
      if (!user) throw errors.notFound("User");
      return ApiResponseHelper.success(user);
    }
  ),
};
```

Available `DatabaseHelper` methods:

- `db.get<T>(sql, params)` - Returns single row or undefined
- `db.all<T>(sql, params)` - Returns array of rows
- `db.run(sql, params)` - Executes INSERT/UPDATE/DELETE, returns lastID/changes

### Authentication & Authorization

**JWT Token System:**

- Access tokens: Short-lived (15m), signed with `JWT_ACCESS_SECRET`
- Refresh tokens: Long-lived (7d), stored in database with bcrypt hash, httpOnly cookie
- Token rotation: New refresh token issued on each refresh request, old one deleted

**Middleware:**

```typescript
// Protected route - requires valid access token
fastify.get("/profile", { preHandler: requireAuth }, userController.getProfile);

// Optional auth - attaches user if token present, otherwise continues
fastify.get("/public", { preHandler: optionalAuth }, controller.handler);
```

**Access user in controllers:**

```typescript
const userId = request.user!.id; // Available after requireAuth
```

### Error Handling

Use `errors` factory from `utils/errorUtils.ts`:

```typescript
throw errors.notFound("User"); // 404
throw errors.validation("Invalid"); // 400
throw errors.unauthorized(); // 401
throw errors.forbidden(); // 403
throw errors.conflict("Exists"); // 409
throw errors.internal("DB error"); // 500
```

Global error handler in `plugins/errorHandlerPlugin.ts` catches `AppError` instances and formats responses consistently.

### Response Format

All responses use `ApiResponseHelper` from `utils/responseUtils.ts`:

```typescript
// Standard success response
return ApiResponseHelper.success(data, "Optional message");

// Paginated response
return ApiResponseHelper.paginated(items, page, limit, total);

// Error response (usually handled by error handler)
return ApiResponseHelper.error("ERROR_CODE", "message");
```

**Standard response structure:**

```typescript
{
  success: boolean,
  data?: T,
  message?: string,
  timestamp: string,
  pagination?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

### Route Registration

Routes use JSON schemas for validation and auto-generate Swagger docs:

```typescript
import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/authMiddleware.ts";
import { userController } from "./userController.ts";
import { getUserSchema, updateUserSchema } from "./userSchemas.ts";

async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/users/:id",
    {
      schema: getUserSchema,
      preHandler: requireAuth,
    },
    userController.getUser
  );

  fastify.patch(
    "/users/:id",
    {
      schema: updateUserSchema,
      preHandler: requireAuth,
    },
    userController.updateUser
  );
}

export default userRoutes;
```

## Development Workflow

### Local Development (Dev Container)

```bash
# Start dev server with hot reload (tsx)
npm run dev

# Build production bundle (tsup with minification)
npm run build && npm start

# Run tests with Vitest
npm test                 # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report

# Access Swagger documentation (dev only)
http://localhost:3000/docs
```

### Database Schema

SQLite auto-initialized in `database.ts` with the following tables:

- **users** - id, username (unique), email (unique), password_hash, oauth_provider, oauth_id, twofa_secret, twofa_enabled, created_at, updated_at, last_seen
- **refresh_tokens** - jti (PK), user_id, token_hash, revoked, created_at, expires_at
- **matches** - id, winner_name, loser_name, winner_score, loser_score, played_at
- **avatars** - id, user_id, file_path, file_url, file_name, mime_type, file_size, uploaded_at

### Configuration

Environment-based config in `config.ts` with validation on startup. Key env vars:

**Server:**

- `PORT` (default: 3000), `HOST` (default: "::"), `NODE_ENV` (default: production)
- `PUBLIC_HOST`, `PUBLIC_PORT`, `PUBLIC_PROTOCOL` - For OAuth redirects

**Database:**

- `DATABASE_PATH` (default: "./src/database/database.db")

**JWT:**

- `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL` (default: "15m"), `JWT_REFRESH_TTL` (default: "7d")

**OAuth:**

- `OAUTH_STATE_SECRET` (for CSRF protection)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

**Routes:**

- `AUTH_PREFIX` (default: "/auth"), `OAUTH_PREFIX` (default: "/api/oauth"), `API_PREFIX` (default: "/api")

**CORS:**

- `CORS_ORIGINS` (comma-separated, default: "http://localhost:4200")

**Logging:**

- `LOG_LEVEL` (default: "info")

### Testing

Tests use Vitest with in-memory SQLite database. See `tests/setup.ts` for test server builder.

Example test structure:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestServer, TestServer } from "./setup.ts";

describe("User API", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await buildTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("should get user by id", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/users/1",
      headers: { authorization: `Bearer ${server.token}` },
    });
    expect(response.statusCode).toBe(200);
  });
});
```

## Adding New Features

Follow this pattern when adding new features:

1. **Create service directory**: `src/services/myService/`
2. **Define types**: `myTypes.ts` with request/response interfaces
3. **Create schemas**: `mySchemas.ts` with JSON schemas for validation + Swagger
4. **Implement controller**: `myController.ts` using `createHandler` wrapper
5. **Register routes**: `myRoutes.ts` with schema and middleware
6. **Add to route registry**: Import and register in `src/routes/index.ts`
7. **Write tests**: `tests/my.test.ts` using test server builder

## API Documentation

In development mode, Swagger UI is available at `/docs` with:

- Full API documentation auto-generated from schemas
- Bearer token authentication support
- Try-it-out functionality for all endpoints
- Organized by tags: health, auth, oauth, users, matches, friends

Configure via `main.ts` Swagger registration block.
