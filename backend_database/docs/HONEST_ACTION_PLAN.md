# Honest Action Plan - From 8/10 to 9/10

**Current State: 8/10** - Solid uni-finishing project with good architecture, security basics, and production awareness.

**Goal: 9/10** - Production-hardened showcase project that demonstrates deep backend understanding.

---

## ✅ What You Already Nailed (Don't Touch)

1. **Config validation** - ✅ Production fails on missing secrets, dev uses fallbacks with warnings. This is CORRECT.
2. **Transaction support** - ✅ Race conditions fixed with proper ACID transactions
3. **Type safety** - ✅ No `any[]` leakage, proper TypeScript throughout
4. **Authentication** - ✅ JWT + refresh rotation + OAuth + 2FA is ambitious and well-executed
5. **Testing** - ✅ 141 passing tests, proper isolated setup
6. **Observability** - ✅ Request IDs, structured logging, health checks
7. **Documentation** - ✅ Copilot instructions are chef's kiss

---

## 🎯 Priority Fixes (8/10 → 9/10)

### P0: Production Hardening (Must-Fix)

#### 1. **Graceful Shutdown** ⏱️ 30min | 🎯 HIGH IMPACT
**Why:** Docker/K8s will send SIGTERM before killing container. Currently, in-flight requests are abandoned mid-operation.

**The Problem:**
```typescript
// main.ts - No signal handlers
await app.listen({ port: config.server.port, host: config.server.host });
// Container gets SIGTERM → immediate process.exit() → database writes fail
```

**Fix:**
```typescript
// In main.ts after await start()
const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, closing server gracefully...`);
    try {
      await app.close(); // Closes DB connection, waits for in-flight requests
      app.log.info("Server closed gracefully");
      process.exit(0);
    } catch (err) {
      app.log.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  });
});
```

**Interview Angle:** "How do you handle container restarts without data loss?" → "Graceful shutdown with SIGTERM handler. Fastify's `close()` waits for in-flight requests and closes DB connections cleanly."

---

#### 2. **Database Migrations** ⏱️ 2-3 hours | 🎯 HIGH IMPACT
**Why:** Current schema init in `database.ts` is fine for greenfield, but what happens when you need to add a column?

**The Problem:**
- No way to evolve schema without dropping database
- No version tracking of schema changes
- Can't rollback breaking changes

**Fix (Simple Approach - No Libraries):**
```bash
# Create migrations folder
mkdir -p src/database/migrations

# Migration format: YYYYMMDDHHMMSS_description.sql
src/database/migrations/
  20241108000000_initial_schema.sql
  20241108000001_add_user_bio.sql
  20241108000002_add_match_location.sql
```

**Migration Runner (`src/database/migrator.ts`):**
```typescript
import { Database } from "sqlite3";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export async function runMigrations(db: Database): Promise<void> {
  // Create migrations table
  await run(db, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get applied migrations
  const applied = await all<{ version: string }>(
    db,
    "SELECT version FROM schema_migrations"
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  // Read migration files
  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.replace(".sql", "");
    if (appliedSet.has(version)) continue;

    console.log(`Applying migration: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf-8");

    await run(db, "BEGIN TRANSACTION");
    try {
      await run(db, sql);
      await run(db, "INSERT INTO schema_migrations (version) VALUES (?)", [version]);
      await run(db, "COMMIT");
      console.log(`✓ Applied ${file}`);
    } catch (err) {
      await run(db, "ROLLBACK");
      throw new Error(`Migration ${file} failed: ${err}`);
    }
  }
}
```

**Update `database.ts`:**
```typescript
// Replace initDb() with:
import { runMigrations } from "./database/migrator.ts";
await runMigrations(db);
```

**Interview Angle:** "How do you manage database schema changes?" → "Migration files with version tracking. Each migration is atomic (wrapped in transaction). Applied migrations are tracked in `schema_migrations` table. Allows rollback and team coordination."

---

#### 3. **Input Sanitization** ⏱️ 1 hour | 🎯 MEDIUM IMPACT
**Why:** You validate schema (good!), but don't sanitize. If username contains `<script>alert('xss')</script>`, you store it raw.

**The Problem:**
```typescript
// Current: User registers with username: "<script>alert('xss')</script>"
// Stored in DB as-is
// If frontend renders: <div>{user.username}</div> → XSS attack
```

**Fix (Simple Approach):**
```typescript
// src/utils/sanitizeUtils.ts
import validator from "validator"; // npm install validator

export function sanitizeString(input: string): string {
  // Remove HTML tags, trim whitespace
  return validator.escape(validator.trim(input));
}

export function sanitizeUsername(username: string): string {
  // Usernames: alphanumeric + underscore/dash only
  return username.replace(/[^a-zA-Z0-9_-]/g, "");
}
```

**Apply in controllers:**
```typescript
// authController.ts - registration
const sanitizedUsername = sanitizeUsername(request.body.username);
const sanitizedEmail = validator.normalizeEmail(request.body.email) || "";

// Validate AFTER sanitization
if (sanitizedUsername !== request.body.username) {
  throw errors.validation("Username contains invalid characters");
}
```

**Interview Angle:** "What's the difference between validation and sanitization?" → "Validation checks format (is email valid?). Sanitization removes dangerous characters (escape HTML). Both are needed - validate to reject bad input, sanitize to prevent injection attacks."

---

#### 4. **Fix Remaining Lint Warnings** ⏱️ 5min | 🎯 LOW IMPACT
**File:** `src/middleware/rateLimitMiddleware.ts:51, 78`

```typescript
// Current:
export async function publicRateLimit(request: FastifyRequest, reply: FastifyReply)

// Fix (if reply is unused):
export async function publicRateLimit(request: FastifyRequest, _reply: FastifyReply)
```

---

### P1: Architecture Improvements (Optional but Valuable)

#### 5. **Remove `createHandler` Abstraction** ⏱️ 1-2 hours | 🎯 SIMPLIFICATION
**Why:** It's over-engineered for this scale. Creates new `DatabaseHelper` on every request for no clear benefit.

**Current Complexity:**
```typescript
// Every controller:
export const userController = {
  getUser: createHandler<{ Params: { id: string } }>(
    async (request, { db }) => {
      // db is a new DatabaseHelper instance
    }
  ),
};
```

**Simpler Alternative:**
```typescript
// Just use request.server.db directly:
export const userController = {
  getUser: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = new DatabaseHelper(request.server.db);
    // ... rest of logic
  },
};

// OR: Decorate Fastify with DatabaseHelper:
// database.ts:
const dbHelper = new DatabaseHelper(db);
fastify.decorate("dbHelper", dbHelper);

// Controller:
const user = await request.server.dbHelper.get(...);
```

**Tradeoff:** 
- **Cost:** 1-2 hours refactoring all controllers
- **Benefit:** Simpler code, less indirection, easier to debug
- **Decision:** Only worth it if you find the current pattern confusing

**Honest Take:** This is a "nice to have" not a "must fix". The current pattern works, it's just not necessary.

---

#### 6. **Consistent Error Context** ⏱️ 1 hour | 🎯 MEDIUM IMPACT
**Current State:** MOSTLY DONE (you already added context to ~80 errors per ACTION_PLAN.md)

**Remaining Issues:**
```bash
# Check for errors without context:
grep -r "throw errors\." src/ | grep -v "endpoint\|userId\|requestId"
```

**Standard Pattern (enforce everywhere):**
```typescript
throw errors.notFound("User", {
  userId: request.params.id,
  endpoint: request.url,
  requestId: request.id, // From requestIdMiddleware
});
```

**Interview Angle:** "How do you debug production issues?" → "Rich error context. Every error includes request ID (for log correlation), user ID, endpoint, and relevant business context. Request IDs let me grep all logs for a single request flow."

---

### P2: Nice-to-Haves (If You Have Time)

#### 7. **Environment-Specific Rate Limits** ⏱️ 30min
```typescript
// rateLimitUtils.ts
const isProduction = config.server.env === "production";

export const RATE_LIMITS = {
  login: isProduction ? { max: 5, window: 5 * 60 } : { max: 100, window: 60 },
  register: isProduction ? { max: 5, window: 5 * 60 } : { max: 100, window: 60 },
  twoFA: isProduction ? { max: 5, window: 15 * 60 } : { max: 100, window: 60 },
};
```

**Why:** Development shouldn't hit rate limits during testing.

---

#### 8. **Cookie Security Hardening** ⏱️ 15min
```typescript
// authUtils.ts - setRefreshTokenCookie
reply.setCookie("refresh_token", refreshToken, {
  httpOnly: true,
  secure: config.server.env === "production", // HTTPS only in prod
  sameSite: "strict", // ← ADD THIS (CSRF protection)
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
});
```

**Interview Angle:** "What's SameSite cookie attribute?" → "CSRF protection. `strict` = cookie only sent to same origin. `lax` = also sent on top-level navigation. `none` = always sent (requires `secure`). We use `strict` because refresh tokens are API-only, no cross-site navigation needed."

---

#### 9. **Database Connection Pooling** ⏱️ 1 hour
**Current:** Single SQLite connection (fine for dev/showcase)
**Production:** Would need connection pool (but SQLite doesn't support concurrent writes anyway)

**Honest Take:** Not needed for SQLite. If you migrate to Postgres, use `pg-pool`. For now, skip this.

---

#### 10. **Better Test Assertions** ⏱️ 2-3 hours | 🎯 HIGH LEARNING VALUE
**Current:** Tests mostly check status codes and `body.success`, with some data validation
**Problem:** Missing deeper assertions that catch regressions and side effects

**What's Missing:**

**A) Database State Verification**
```typescript
// Current (user.test.ts):
it("PATCH /users/:id should update username", async () => {
  const res = await app.inject({...});
  expect(res.statusCode).toBe(200);
  expect(body.data?.username).toBe("newusername");
});

// Better:
it("PATCH /users/:id should update username", async () => {
  const res = await app.inject({...});
  expect(res.statusCode).toBe(200);
  expect(body.data?.username).toBe("newusername");
  
  // Verify DB was actually updated
  const dbUser = await app.db.get(
    "SELECT username FROM users WHERE id = ?", 
    [userId]
  );
  expect(dbUser.username).toBe("newusername");
});
```

**B) Side Effect Testing**
```typescript
// Current (auth.test.ts):
it("POST /refresh should rotate tokens", async () => {
  const refreshRes = await app.inject({...});
  expect(refreshRes.statusCode).toBe(200);
  expect(newRefreshCookie?.value).not.toBe(refreshCookie!.value);
});

// Better:
it("POST /refresh should rotate tokens and revoke old token", async () => {
  const refreshRes = await app.inject({...});
  expect(refreshRes.statusCode).toBe(200);
  
  // New token should work
  const newRefreshCookie = refreshRes.cookies.find(c => c.name === "refresh_token");
  expect(newRefreshCookie).toBeDefined();
  
  // Old token should be deleted from DB
  const oldToken = await app.db.get(
    "SELECT * FROM refresh_tokens WHERE jti = ?",
    [oldJti]
  );
  expect(oldToken).toBeNull();
  
  // Using old token should fail
  const retryRes = await app.inject({
    method: "POST",
    url: "/auth/refresh",
    cookies: { refresh_token: refreshCookie.value }
  });
  expect(retryRes.statusCode).toBe(401);
});
```

**C) Error Response Structure**
```typescript
// Current:
it("should return 404 for non-existent user", async () => {
  const res = await app.inject({...});
  expect(res.statusCode).toBe(404);
  expect(body.success).toBe(false);
});

// Better:
it("should return 404 with proper error structure", async () => {
  const res = await app.inject({...});
  expect(res.statusCode).toBe(404);
  
  // Verify error response structure
  expect(body).toMatchObject({
    success: false,
    error: "NOT_FOUND",
    message: expect.stringContaining("User"),
    timestamp: expect.any(String)
  });
  
  // Should NOT leak sensitive data
  expect(body).not.toHaveProperty("stack");
  expect(body.message).not.toContain("SELECT"); // No SQL in errors
});
```

**D) Edge Cases & Boundaries**
```typescript
// Current: Basic validation test
it("should reject invalid score", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/matches",
    payload: { winner_score: -1, loser_score: 10, ... }
  });
  expect(res.statusCode).toBe(400);
});

// Better: Test ALL boundaries
describe("Match score validation", () => {
  it.each([
    { winner_score: -1, loser_score: 10, reason: "negative winner" },
    { winner_score: 10, loser_score: -1, reason: "negative loser" },
    { winner_score: 0, loser_score: 0, reason: "both zero" },
    { winner_score: 10, loser_score: 10, reason: "tie" },
    { winner_score: 10, loser_score: 11, reason: "loser higher" },
  ])("should reject invalid scores: $reason", async ({ winner_score, loser_score }) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/matches",
      payload: { winner_score, loser_score, winner: "user1", loser: "user2" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBeTruthy();
  });
});
```

**E) Integration Testing (Not Just Unit)**
```typescript
// Current: Tests are isolated
it("should create user", async () => { /* ... */ });
it("should login user", async () => { /* ... */ });

// Better: Test workflows
it("complete user journey: register → login → update profile → logout", async () => {
  // 1. Register
  const registerRes = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username: "journey", email: "journey@test.com", password: "pass123", confirmPassword: "pass123" }
  });
  expect(registerRes.statusCode).toBe(201);
  const { id, tokens } = registerRes.json().data;
  
  // 2. Login
  const loginRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "journey@test.com", password: "pass123" }
  });
  expect(loginRes.statusCode).toBe(200);
  const newAccessToken = loginRes.json().data.tokens.accessToken;
  
  // 3. Update profile
  const updateRes = await app.inject({
    method: "PATCH",
    url: `/api/users/${id}`,
    headers: { authorization: `Bearer ${newAccessToken}` },
    payload: { username: "updated_journey" }
  });
  expect(updateRes.statusCode).toBe(200);
  expect(updateRes.json().data.username).toBe("updated_journey");
  
  // 4. Verify change persists on re-login
  const reloginRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "journey@test.com", password: "pass123" }
  });
  expect(reloginRes.json().data.username).toBe("updated_journey");
});
```

**F) Test Helpers for Repeated Patterns**
```typescript
// tests/helpers.ts
export async function createAuthenticatedUser(
  app: FastifyInstance, 
  username = "testuser",
  email = "test@example.com"
) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      username,
      email,
      password: "testpass123",
      confirmPassword: "testpass123"
    }
  });
  return {
    userId: res.json().data.id,
    accessToken: res.json().data.tokens.accessToken,
    username,
    email
  };
}

// Use in tests:
it("should get user profile", async () => {
  const { userId, accessToken } = await createAuthenticatedUser(app);
  const res = await app.inject({
    method: "GET",
    url: `/api/users/${userId}`,
    headers: { authorization: `Bearer ${accessToken}` }
  });
  expect(res.statusCode).toBe(200);
});
```

**Priority Areas to Improve:**
1. ✅ Token refresh tests - verify old tokens are revoked in DB
2. ✅ Registration tests - verify avatar was created, user exists in DB
3. ✅ Update tests - verify DB state changed, not just response
4. ✅ Delete tests - verify related data is handled (cascade vs orphan)
5. ✅ Error responses - verify structure, no sensitive data leaks
6. ✅ Pagination tests - verify page boundaries, total counts
7. ✅ Rate limiting tests - verify actual blocking, not just first request
8. ✅ OAuth tests - verify state validation, token storage

**Interview Angle:**
"What's the difference between a good test and a great test?"
→ "Good tests verify the happy path and status codes. Great tests verify:
  1. **Side effects** - Did the DB actually change?
  2. **Cleanup** - Are old tokens revoked? Files deleted?
  3. **Edge cases** - Boundaries, race conditions, error paths
  4. **Integration** - Do multi-step workflows work end-to-end?
  5. **Security** - No data leaks in errors, auth enforced everywhere"

---

## 📊 Effort vs Impact Matrix

| Priority | Task | Time | Impact | Do It? |
|----------|------|------|--------|--------|
| **P0** | Graceful shutdown | 30min | HIGH | ✅ YES |
| **P0** | Database migrations | 2-3h | HIGH | ✅ YES |
| **P0** | Input sanitization | 1h | MEDIUM | ✅ YES |
| **P0** | Fix lint warnings | 5min | LOW | ✅ YES |
| **P1** | Better test assertions | 2-3h | HIGH LEARNING | ✅ YES |
| **P1** | Remove createHandler | 1-2h | LOW | ⚠️ OPTIONAL |
| **P1** | Error context audit | 1h | MEDIUM | ✅ YES |
| **P2** | Env-specific rate limits | 30min | LOW | ⚠️ OPTIONAL |
| **P2** | Cookie SameSite | 15min | MEDIUM | ✅ YES |

**Total Time for 8/10 → 9/10: ~8-10 hours** (includes comprehensive test improvements)

---

## 🎓 Concepts to Master (Interview Prep)

Based on what you've built, study these deeper:

1. **Database Transactions & ACID** - You use them, now understand isolation levels (Read Committed vs Serializable)
2. **Graceful Shutdown** - Why SIGTERM vs SIGKILL, how to handle in-flight requests
3. **JWT Security** - Token rotation, refresh token theft scenarios, mitigation strategies
4. **Rate Limiting Strategies** - Token bucket vs fixed window, distributed rate limiting with Redis
5. **Input Validation vs Sanitization** - When to reject, when to clean
6. **Database Migrations** - Up/down migrations, zero-downtime deploys, rollback strategies
7. **Observability** - Request IDs/correlation IDs, structured logging, metrics vs logs vs traces
8. **OAuth Flow Security** - State parameter (CSRF), PKCE for public clients, token storage

---

## 🚀 Final Assessment

**Current Rating: 8/10**
- ✅ Solid architecture
- ✅ Good security awareness
- ✅ Production-minded (logging, transactions, tests)
- ✅ Config validation is actually excellent (I was wrong!)
- ❌ Missing: migrations, graceful shutdown, sanitization

**After P0 Fixes: 9/10**
- Production-ready hardening
- Demonstrates understanding of operational concerns
- Shows attention to security and reliability

**What Stops This From Being 10/10:**
- Not using a query builder (Prisma/Drizzle) for type-safe queries
- SQLite (single-writer bottleneck for real production)
- No distributed tracing (OpenTelemetry)
- No metrics/monitoring (Prometheus)

But honestly? **For a uni project, 9/10 is EXCELLENT.** A 10/10 would be over-engineering.

---

## 🎯 Recommended Next Steps

**This Weekend (5-6 hours):**
1. Graceful shutdown (30min)
2. Database migrations (2-3h)
3. Input sanitization (1h)
4. Cookie SameSite + lint fixes (20min)
5. Error context audit (1h)

**Result:** Production-hardened 9/10 showcase project that demonstrates senior-level thinking.

**For Interviews:**
- Be able to explain WHY each pattern exists
- Know the tradeoffs (SQLite vs Postgres, raw SQL vs query builder)
- Explain what you'd change for true production scale

You're already ahead of most bootcamp grads. Fix the P0 items and you're golden. 🔥
