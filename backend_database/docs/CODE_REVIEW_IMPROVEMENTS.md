# Code Review - Priority Improvements

## Skills to Dive Deeper Into 🎯

- **Database Migrations** - Learn migration tools (Knex, TypeORM, Prisma) and versioning strategies
- **Database Transactions** - ACID properties, isolation levels, rollback strategies for multi-step operations
- **Caching Strategies** - Redis fundamentals, cache invalidation patterns, when/what to cache
- **Observability** - Structured logging with correlation IDs, metrics (Prometheus), distributed tracing
- **Horizontal Scaling** - Stateless design, load balancing, session management across instances
- **API Versioning** - Strategies for backward compatibility and deprecation
- **Security Hardening** - Defense in depth, input sanitization vs validation, rate limiting per user
- **Error Context & Debugging** - Building errors with rich context for production troubleshooting

---

## Critical Issues to Fix

### 1. Config File - Dangerous Defaults
**File:** `src/config.ts`
**Issue:** Secrets have fallback defaults like "dev-access-secret-change-me"
**Risk:** If someone forgets env vars, app runs in production with known weak secrets
**Fix:** 
```typescript
// Instead of:
accessSecret: getEnvVar("JWT_ACCESS_SECRET", "dev-access-secret-change-me")

// Do:
accessSecret: config.server.env === "production" 
  ? getEnvVar("JWT_ACCESS_SECRET") // No default, will throw
  : getEnvVar("JWT_ACCESS_SECRET", "dev-secret-ok-for-local")
```

### 2. Database Helper - Lost Type Safety
**File:** `src/utils/databaseUtils.ts`
**Issue:** `params: any[]` loses type safety at the most critical point (SQL params)
**Problem:** Can pass wrong types to SQL queries without TypeScript catching it
**Fix:** Consider using a query builder or at minimum use `unknown[]` and validate

### 3. Database Helper - Mixed Concerns
**File:** `src/utils/databaseUtils.ts`
**Issue:** `getAvatarUrl()` is too specific for a generic database helper
**Problem:** Helper becomes bloated with domain logic instead of being pure data access
**Fix:** Move avatar logic to a separate `AvatarRepository` or service layer

### 4. Error Messages - No Context
**File:** `src/utils/errorUtils.ts`
**Issue:** Errors like "User not found" have zero context
**Problem:** When debugging production: which user? which endpoint? which request?
**Fix:**
```typescript
// Instead of:
throw errors.notFound("User");

// Include:
throw errors.notFound(`User ${userId} not found`, {
  userId,
  endpoint: request.url,
  method: request.method,
  requestId: request.id // Add request ID to all requests
});
```

### 5. Test Setup - Silent Failures
**File:** `tests/setup.ts` (lines 44, 49)
**Issue:** Empty catch blocks with unused error variables
**Problem:** Errors are swallowed, making debugging test failures harder
**Fix:**
```typescript
} catch (err) {
  // If it's expected, at least log it in test mode
  if (process.env.TEST_VERBOSE) {
    console.log('Expected error cleaning up test avatars:', err);
  }
}
```

### 6. Route Registration - Sequential Instead of Parallel
**File:** `src/routes/index.ts`
**Issue:** All route registrations await sequentially
**Problem:** Server startup is slower than necessary
**Fix:**
```typescript
await Promise.all([
  fastify.register(authRoutes, { prefix: config.routes.auth }),
  fastify.register(oauthRoutes, { prefix: config.routes.oauth }),
  fastify.register(userRoutes, { prefix: config.routes.api }),
  // ... etc
]);
```

### 7. Main Server Build - Sequential Plugin Registration
**File:** `src/main.ts`
**Issue:** All plugins registered with await in sequence
**Problem:** Same as above - unnecessary startup delays
**Note:** Some plugins must be sequential (db before routes), but CORS, rate-limit, cookie can be parallel

---

## Security Gaps

### 1. No Input Sanitization
**Location:** All input handling
**Issue:** Validate format but don't sanitize malicious input
**Example:** Username `<script>alert('xss')</script>` passes validation
**Risk:** Stored XSS if client-side doesn't escape properly
**Fix:** Add sanitization library (DOMPurify or validator.js) to strip/escape HTML

### 2. No Rate Limiting Per User
**Location:** `src/main.ts` rate limit config
**Issue:** Global rate limit only (20 req/sec for ALL users)
**Problem:** One user can't DoS server, but also can't make 21 requests quickly for legit use
**Fix:** Add per-user rate limiting for authenticated endpoints

### 3. No Password Complexity Requirements
**Location:** `src/services/authService/authSchemas.ts`
**Issue:** Only checks minLength: 8
**Risk:** Users can set "password" or "12345678"
**Fix:** Add regex for complexity (upper, lower, number, special char)

### 4. No Account Lockout
**Location:** Login flow
**Issue:** Unlimited login attempts allowed
**Risk:** Brute force attacks possible
**Fix:** Track failed attempts, lock account after 5 failures, require unlock mechanism

---

## Architecture Issues

### 1. Handler Pattern Over-Engineering
**File:** `src/utils/handlerUtils.ts`
**Issue:** `createHandler` adds abstraction without clear benefit
**Reality Check:** You're just injecting `DatabaseHelper` - could do this simpler
**Question:** Does this pattern actually solve a problem you have?
**Alternative:** Use Fastify decorators or pass db in context directly

### 2. No Database Transactions
**Critical Locations:**
- `authController.refresh` - deletes old token, creates new (atomic operation needed)
- `friendController` - updates multiple rows
- Any multi-step DB operations

**Risk:** Partial failures leave data inconsistent
**Example:** 
```typescript
// Current: If second operation fails, old token is deleted but no new token
await db.run("DELETE FROM refresh_tokens WHERE jti = ?", [jti]);
const newToken = await generateAndStoreRefreshToken(userId); // <- if this fails, user locked out
```

**Fix:** Wrap in transactions:
```typescript
await db.beginTransaction();
try {
  await db.run("DELETE...");
  await db.run("INSERT...");
  await db.commit();
} catch (err) {
  await db.rollback();
  throw err;
}
```

### 3. No Database Migration Strategy
**Issue:** Schema defined in code, changes require manual intervention
**Problem for Future:**
- Can't version database changes
- Can't rollback schema changes
- Can't coordinate schema changes with code deploys
- Team members might have different schemas locally

**Fix:** Use migration library (node-pg-migrate, Knex, or Prisma)

### 4. SQLite Limitations Not Addressed
**Not Your Fault:** SQLite is fine for school project
**Future Problem:** 
- No concurrent writes (only one write at a time)
- File-based storage doesn't work with multiple app instances
- No built-in replication

**Plan Ahead:** Document migration path to PostgreSQL/MySQL

---

## Testing Improvements

### 1. Shallow Tests
**Issue:** Many tests only check status codes
**Example:**
```typescript
expect(response.statusCode).toBe(200);
// But don't check response body structure, data correctness, side effects
```

**Better:**
```typescript
expect(response.statusCode).toBe(200);
expect(response.json().data.username).toBe('testuser');
expect(response.json().data).not.toHaveProperty('password_hash');
// Verify side effects:
const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
expect(user.last_seen).toBeDefined();
```

### 2. No Integration Tests with External Services
**Missing:** Tests for OAuth flow with mocked GitHub/Google responses
**Current:** OAuth tests exist but may not cover all edge cases
**Add:** Mock external API responses to test error handling

---

## Performance Issues

### 1. N+1 Query Potential
**Location:** Friend status queries, any loops with DB calls
**Example:** Loading friends then loading each friend's details in a loop
**Fix:** Use JOINs or batch queries

### 2. No Pagination Limits Enforced
**Issue:** Can request all users with no limit
**Risk:** `GET /users` could return 100k users and crash client/server
**Fix:** 
```typescript
const limit = Math.min(request.query.limit || 20, 100); // Max 100
const page = request.query.page || 1;
```

### 3. No Caching Headers
**Issue:** Every request hits database even for unchanged data
**Missing:** ETag, Cache-Control, Last-Modified headers
**Impact:** Unnecessary load on server and slow response for clients

---

## Missing Production Essentials

### 1. No Request Correlation IDs
**Issue:** Can't trace a single request through logs
**Fix:** Add request ID middleware, include in all logs and errors
```typescript
fastify.addHook('onRequest', (request, reply, done) => {
  request.id = crypto.randomUUID();
  done();
});
```

### 2. Health Check Doesn't Check Database
**File:** `src/routes/healthRoutes.ts`
**Issue:** Returns 200 even if database is down
**Fix:** Actually query database in health check

### 3. No Graceful Shutdown
**Issue:** Server stops immediately, might cut off in-flight requests
**Fix:** Handle SIGTERM/SIGINT, close database connections properly

### 4. No Metrics Endpoint
**Missing:** Prometheus metrics, request duration, error rates
**Need:** `/metrics` endpoint for monitoring tools

---

## Quick Wins (Easy to Fix Now)

1. ✅ Fix unused error variables in `tests/setup.ts`
2. ✅ Make route registration parallel
3. ✅ Add request ID to all requests
4. ✅ Improve error messages with context
5. ✅ Add health check that actually checks database
6. ✅ Enforce pagination limits
7. ✅ Add password complexity validation
8. ✅ Remove dangerous default secrets in production mode

---

## Future Architectural Changes (Bigger Effort)

1. 🔄 Implement database migration system
2. 🔄 Add transaction support to DatabaseHelper
3. 🔄 Implement Redis caching layer
4. 🔄 Move to PostgreSQL for production
5. 🔄 Implement proper API versioning
6. 🔄 Add object storage for avatars (S3/R2)
7. 🔄 Implement distributed rate limiting
8. 🔄 Add observability stack (metrics, tracing)

---

## The Bottom Line

**What's Actually Wrong:** Not the architecture or patterns - those are solid for learning. The gaps are:
1. Missing operational concerns (migrations, transactions, monitoring)
2. Security hardening details (sanitization, rate limiting, account protection)
3. Error handling lacks production-debugging context
4. Some over-engineering (handler pattern) vs under-engineering (no transactions)

**What's Actually Right:** The structure, testing discipline, documentation, security awareness, and modern tooling choices are all excellent for a student project.

**Priority:** Fix quick wins first, then tackle architectural improvements as you learn more about production systems.
