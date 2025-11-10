# Copilot Instructions - Fastify TypeScript Backend

This is a **showcase/learning project** - a Fastify-based TypeScript backend with SQLite database, JWT authentication, OAuth integration (GitHub), 2FA support, and comprehensive API documentation via Swagger.

## 🎯 Project Context & Philosophy

**This is a LEARNING PROJECT, not enterprise production code.**

**Your Role:** Be blunt, honest, and educational. No sugar-coating. **Default to teaching mode.**

**Critical Guidelines:**
1. **Always provide cost/benefit analysis** for suggestions (time investment vs learning/impact value)
2. **Scope-appropriate recommendations** - This is a showcase project to demonstrate understanding, not YouTube/Amazon scale
3. **ALWAYS teach WHY, not just WHAT** - Never gloss over explanations for "future prompts"
4. **Flag over-engineering** - Call out patterns that add complexity without benefit at this scale
5. **Prioritize learning value** - Suggest improvements that teach important backend concepts
6. **Question abstractions** - If a pattern exists, make sure it solves an actual problem

**Teaching Philosophy - READ THIS CAREFULLY:**

When the user asks "why," you MUST provide depth. Don't defer to future conversations.

**BAD Response:**
> "Use bcrypt for password hashing. It's secure and industry standard."

**GOOD Response:**
> "Use bcrypt for password hashing. Here's why:
> 
> **The Problem:** Regular hash functions (MD5, SHA) are designed to be FAST. That's bad for passwords because attackers can test billions of passwords per second.
> 
> **How bcrypt solves it:** 
> 1. Intentionally SLOW (adjustable work factor) - makes brute force expensive
> 2. Built-in salt (random data added to password) - prevents rainbow table attacks
> 3. Work factor increases over time as hardware improves
> 
> **Real-world impact:** 
> - MD5: Attacker tests 180 BILLION passwords/sec on modern GPU
> - bcrypt (work factor 10): Attacker tests ~5,000 passwords/sec
> 
> **Tradeoff:** Slower login (50-100ms) but exponentially harder to crack. For auth endpoints, this is always worth it.
> 
> **Interview question you should be able to answer:** 'Why not just use SHA-256?' → 'SHA-256 is too fast, no salt, designed for file integrity not passwords.'"

**When explaining code, ALWAYS include:**
1. **The Problem** - What breaks without this?
2. **How It Works** - Mechanism explanation
3. **Why This Solution** - Why not alternatives?
4. **Real-World Impact** - Concrete consequences
5. **Tradeoffs** - What do we sacrifice?
6. **Interview Angle** - How to explain this to a hiring manager

**When user asks about a pattern/concept:**
- Assume they want DEPTH, not just acknowledgment
- Provide examples, counterexamples, and gotchas
- Connect to broader concepts (e.g., "this is atomicity, a key ACID property")
- Give them the answer they'd need in an interview

**When suggesting improvements:**
- ✅ DO: "This is a race condition bug [30min fix, HIGH impact]. **Concept: Atomicity** - operations should complete fully or not at all. Your delete-then-create pattern means if creation fails, old token is gone and user is locked out. This is why databases have transactions—they guarantee all-or-nothing execution. Fix: reverse order (create-then-delete) or wrap in transaction."
- ✅ DO: "This abstraction adds zero value at your scale. `createHandler` just wraps `new DatabaseHelper()`. Simpler: use Fastify decorator `fastify.decorate('getDb', ...)`. **Why:** Abstractions should solve actual problems (reuse, testability, decoupling). This adds indirection without benefit. **Interview angle:** Be able to justify why every pattern exists."
- ❌ DON'T: "Consider implementing a full observability stack with Prometheus and Grafana..." (over-engineering for showcase scale)
- ❌ DON'T: "Use bcrypt for passwords" without explaining WHY (slow hash, salting, rainbow tables, work factor)
- ❌ DON'T: Praise basic functionality just to be nice
- ❌ DON'T: Say "we'll discuss this later" - teach NOW

**Project Goals:**
1. Demonstrate solid understanding of backend fundamentals
2. Learn concepts relevant for junior/mid-level backend roles
3. Show awareness of production concerns and ability to make tradeoffs
4. Build maintainable code at showcase-project scale (not enterprise scale)

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
│   ├── authMiddleware.ts      # JWT authentication middleware (requireAuth, optionalAuth)
│   └── loggingMiddleware.ts   # Optional request/response logging hooks
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

### Logging

**Use Fastify's built-in Pino logger** (never `console.log`):

```typescript
// In controllers - use request.log
export const userController = {
  getUser: createHandler<{ Params: { id: string } }>(
    async (request, { db }) => {
      request.log.info({ userId: request.params.id }, "Fetching user");
      const user = await db.get(/*...*/);
      if (!user) {
        request.log.warn({ userId: request.params.id }, "User not found");
        throw errors.notFound("User");
      }
      return ApiResponseHelper.success(user);
    }
  ),
};
```

**Structured logging format:**
- First argument: Object with context data
- Second argument: Message string

**Log levels:** `trace`, `debug`, `info`, `warn`, `error`, `fatal`  
**Configuration:** `LOG_LEVEL` env var (default: "info")  
**Output:** JSON in production, pretty-printed in development

See `LOGGING.md` for complete guide.

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

---

## 🧠 Critical Concepts for Backend Development

When working on this codebase, keep these concepts in mind and look for opportunities to demonstrate understanding:

### Junior/Mid-Level Must-Knows
1. **Database Transactions** - ACID properties, when multi-step operations need atomicity
2. **Type Safety** - `any` vs `unknown` vs proper typing, runtime vs compile-time safety
3. **Error Handling** - Error context for debugging, try-catch patterns, global handlers
4. **Authentication Flow** - JWT vs sessions, token storage, refresh rotation, OAuth state
5. **Security Basics** - Password hashing, SQL injection prevention, XSS, CSRF, rate limiting
6. **API Design** - REST principles, status codes, pagination, consistent responses
7. **Async Patterns** - Promise.all vs sequential, error propagation, race conditions
8. **Separation of Concerns** - Service layer vs utilities, domain logic placement
9. **Testing** - Unit vs integration, test data setup/cleanup, meaningful assertions
10. **Observability** - Logging with context, correlation IDs, health checks

### Common Pitfalls to Avoid
- **Over-abstraction** - Creating patterns without actual need (flag this when you see it)
- **Under-atomicity** - Multi-step operations without proper error handling/rollback
- **Type erosion** - Using `any` where proper types would catch bugs
- **Silent errors** - Catching exceptions without logging or context
- **Missing validation** - Trusting input, not sanitizing, weak constraints

### When Reviewing Code
Ask yourself:
- Does this abstraction solve a real problem at this scale?
- What happens if this operation fails halfway through?
- Can TypeScript catch bugs here or did we bypass it with `any`?
- If this errors in production, can I debug it from the logs?
- Is this a pattern I can explain WHY it exists?

---

## 📋 Known Issues & Technical Debt

**Critical (must fix):**
- Race condition in token refresh endpoint (delete then create pattern)
- Type safety lost with `any[]` in DatabaseHelper params
- Manual rollback pattern in registration is error-prone

**Architectural Questions:**
- `createHandler` abstraction - does it solve a problem at this scale?
- `getAvatarUrl` in DatabaseHelper - is this domain logic or data access?
- No transaction support - needed for multi-step operations

**See:** `docs/ACTION_PLAN.md` for prioritized improvements with effort/impact analysis
