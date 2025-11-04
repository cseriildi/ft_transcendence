# Action Plan - Priority Fixes & Learning Objectives

**Project Rating: 7/10** - Solid fundamentals, but critical bugs and gaps in production concepts

---

## 🚨 P0: Critical Bugs (MUST FIX - These Break Things)

### 1. Race Condition in Token Refresh [HIGH IMPACT, LOW EFFORT]
**File:** `src/services/authService/authController.ts:70-71`
**Bug:** Delete old token → generate new token. If second step fails, user is locked out.
**Why This Matters:** This is a **data integrity bug**. You'll see random logout issues in production.
**Cost:** 30 minutes | **Impact:** Prevents data corruption
**Fix:** Wrap in try-catch with rollback OR use a different pattern (mark old as revoked, create new, then delete old)
```typescript
// Current (BROKEN):
await db.run("DELETE FROM refresh_tokens WHERE jti = ?", [decoded.jti]);
const newRefreshToken = await generateAndStoreRefreshToken(db, user.id);

// Option 1: Defensive (no transactions needed):
const newRefreshToken = await generateAndStoreRefreshToken(db, user.id);
await db.run("DELETE FROM refresh_tokens WHERE jti = ?", [decoded.jti]);

// Option 2: With proper error handling:
try {
  const newRefreshToken = await generateAndStoreRefreshToken(db, user.id);
  await db.run("DELETE FROM refresh_tokens WHERE jti = ?", [decoded.jti]);
} catch (err) {
  // If new token creation fails, old token still valid - no lockout
  throw err;
}
```
**Concept to Learn:** Atomicity - operations should either fully succeed or fully fail, never leave partial state

### 2. Type Safety Destroyed in DatabaseHelper [MEDIUM IMPACT, LOW EFFORT]
**File:** `src/utils/databaseUtils.ts:37, 47, 57`
**Bug:** `params: any[]` - TypeScript can't catch wrong types passed to SQL
**Why This Matters:** Silent bugs where you pass `[userId]` but meant `[username]`
**Cost:** 5 minutes | **Impact:** Prevents type-related runtime errors
**Fix:**
```typescript
// Instead of:
async get<T = any>(sql: string, params: any[] = []): Promise<T | null>

// Use:
async get<T = any>(sql: string, params: unknown[] = []): Promise<T | null>
```
`unknown` forces you to validate/assert types, `any` bypasses all checks.
**Concept to Learn:** Type safety isn't just for compile time - it's documentation and prevents bugs

### 3. Registration Rollback is Broken [MEDIUM IMPACT, MEDIUM EFFORT]
**File:** `src/services/authService/authController.ts:171-177`
**Bug:** Manual rollback (delete user + file) will fail if either operation fails
**Why This Matters:** You're attempting atomicity manually, but doing it wrong
**Cost:** 1 hour | **Impact:** Prevents orphaned data
**Current Code:**
```typescript
if (!insert) {
  await deleteUploadedFile(avatar.fileUrl);  // If this fails...
  await db.run("DELETE FROM users WHERE id = ?", [result.lastID]); // ...user is not deleted
  throw errors.internal("...");
}
```
**Fix:** Reverse order + wrap in try-catch, OR rethink the flow
**Concept to Learn:** This is why databases have transactions - manual rollback is error-prone

---

## 🔥 P1: High-Impact, Low-Effort Wins

### 4. Health Check is Fake [5 MIN]
**File:** `src/routes/healthRoutes.ts`
**Issue:** Returns 200 even if database is down
**Cost:** 5 minutes | **Impact:** Actual monitoring capability
**Fix:** Actually query the database:
```typescript
const result = await db.get("SELECT 1");
return { status: 'healthy', database: result ? 'connected' : 'disconnected' };
```

### 5. Useless Try-Catch Blocks [5 MIN]
**Files:** `authController.ts:38, 85, 217`
**Issue:** `try { ... } catch (err: any) { throw err; }` - does literally nothing
**Cost:** 2 minutes | **Impact:** Cleaner code
**Fix:** Delete the try-catch entirely if you're not handling the error

### 6. Domain Logic in Database Utility [10 MIN]
**File:** `src/utils/databaseUtils.ts:10-20`
**Issue:** `getAvatarUrl()` is avatar business logic in a generic DB helper
**Why This Matters:** Violates Single Responsibility Principle
**Cost:** 10 minutes | **Impact:** Better separation of concerns
**Fix:** Move to `AvatarService` or `UserService`
**Concept to Learn:** Utilities should be generic, domain logic should be in services

### 7. Sequential Route Registration [5 MIN]
**File:** `src/routes/index.ts`
**Issue:** All routes registered with `await` in sequence - slow startup
**Cost:** 5 minutes | **Impact:** Faster server startup
**Fix:**
```typescript
await Promise.all([
  fastify.register(authRoutes, { prefix: config.routes.auth }),
  fastify.register(oauthRoutes, { prefix: config.routes.oauth }),
  // ... etc
]);
```

### 8. No Error Context [15 MIN]
**Files:** All error throwing
**Issue:** Errors like "User not found" with zero debugging info
**Cost:** 15 minutes | **Impact:** Debuggability in production
**Fix:**
```typescript
// Instead of:
throw errors.notFound("User");

// Do:
throw errors.notFound("User", { 
  userId: request.params.id, 
  endpoint: request.url,
  requestId: request.id // Need to add request ID middleware first
});
```
**Concept to Learn:** Errors in production need context - you won't have a debugger

---

## 🎯 P2: Important Concepts for Junior/Mid Dev Role

### 9. Database Transactions (YOU NEED TO LEARN THIS) [2-3 HOURS]
**Current Gap:** No transaction support in DatabaseHelper
**Why Critical for Interviews:** This is a fundamental database concept
**Effort:** Medium | **Learning Value:** HIGH
**What You Need to Understand:**
- ACID properties (Atomicity, Consistency, Isolation, Durability)
- When to use transactions vs when not to
- Isolation levels and race conditions
- How to implement in SQLite (BEGIN, COMMIT, ROLLBACK)

**Implementation:**
```typescript
// Add to DatabaseHelper:
async transaction<T>(callback: (db: DatabaseHelper) => Promise<T>): Promise<T> {
  await this.run("BEGIN TRANSACTION");
  try {
    const result = await callback(this);
    await this.run("COMMIT");
    return result;
  } catch (err) {
    await this.run("ROLLBACK");
    throw err;
  }
}

// Usage:
await db.transaction(async (tx) => {
  await tx.run("DELETE FROM refresh_tokens WHERE jti = ?", [jti]);
  await tx.run("INSERT INTO refresh_tokens ...", [...]);
  return newToken;
});
```

### 10. Request Correlation IDs [30 MIN]
**Current Gap:** Can't trace a single request through logs
**Why Critical:** Every production system has this
**Effort:** Low | **Learning Value:** MEDIUM
**Implementation:**
```typescript
// Add to main.ts:
app.addHook('onRequest', (request, reply, done) => {
  request.id = request.headers['x-request-id'] || crypto.randomUUID();
  reply.header('x-request-id', request.id);
  done();
});

// Then in all logs:
request.log.info({ requestId: request.id, userId }, "Action performed");
```

### 11. Password Complexity Validation [10 MIN]
**Current Gap:** Only checks minLength: 8 - allows "password" or "12345678"
**Why Critical:** Security basics for interviews
**Effort:** Low | **Impact:** Shows security awareness
**Fix:**
```typescript
// In authSchemas.ts:
password: {
  type: 'string',
  minLength: 8,
  pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
  errorMessage: 'Password must contain uppercase, lowercase, number, and special character'
}
```

### 12. Rate Limiting Per User [1 HOUR]
**Current Gap:** Global rate limit only (20 req/sec for ALL users)
**Why It Matters:** Current system is too restrictive AND too permissive
**Effort:** Medium | **Learning Value:** MEDIUM
**Concept:** Need different limits for different scenarios:
- Anonymous: 10/min
- Authenticated: 100/min  
- Login attempts: 5 per 15 min per IP

---

## 🤔 Things You Implemented But May Not Fully Understand

### 13. The `createHandler` Pattern
**What You Did:** Created abstraction to inject `DatabaseHelper`
**Reality Check:** This is over-engineering for what it does
**Why:** You're just wrapping `new DatabaseHelper(request.server.db)` - could use Fastify decorators
**Learning Point:** Abstractions should solve actual problems, not just look like patterns you've seen
**Question to Ask Yourself:** What problem does this solve? Could I do it simpler?

**Alternative (simpler):**
```typescript
// In database.ts plugin:
fastify.decorate('getDb', () => new DatabaseHelper(fastify.db));

// In controllers (no createHandler needed):
export const authController = {
  verifyToken: async (request: FastifyRequest, reply: FastifyReply) => {
    const db = request.server.getDb();
    // ... rest of logic
  }
}
```

### 14. JWT Token Rotation
**What You Did:** Implemented refresh token rotation (good!)
**What You Might Not Understand:** WHY it matters
**Concept:** If refresh token is stolen, attacker has limited window before real user rotates it
**Interview Question:** "Why rotate refresh tokens instead of just having long-lived tokens?"
**Answer:** Limits damage from token theft, provides audit trail, allows remote logout

### 15. OAuth State Parameter
**What You Did:** Implemented state validation (good!)
**What You Might Not Understand:** The attack it prevents
**Concept:** CSRF attack where attacker tricks you into logging into THEIR account
**Interview Question:** "What is the OAuth state parameter for?"
**Answer:** CSRF protection - ensures the OAuth callback is for the session that initiated it

---

## 📚 P3: Nice-to-Haves (Polish & Learning)

### 16. Pagination Limits [5 MIN]
**Issue:** Can request unlimited results - could return 100k records
**Fix:** 
```typescript
const limit = Math.min(request.query.limit || 20, 100); // Max 100
```

### 17. Account Lockout After Failed Logins [1-2 HOURS]
**Concept:** Track failed attempts, lock after 5 failures
**Learning Value:** Security patterns, Redis/caching introduction

### 18. Input Sanitization vs Validation [30 MIN]
**Current:** You validate format, but don't sanitize malicious input
**Example:** Username `<script>alert('xss')</script>` passes validation
**Fix:** Add sanitization library OR at minimum escape HTML
**Concept:** Validation = "is it correct format", Sanitization = "make it safe"

### 19. Database Migration System [3-4 HOURS]
**Current:** Schema is hardcoded in database.ts
**Problem:** Can't version changes, can't rollback, team members have different schemas
**Concept:** Critical for production, but overkill for showcase project
**Recommendation:** Document it, don't implement (unless you want to learn migrations)

### 20. Better Test Assertions [2 HOURS]
**Current:** Most tests only check status codes
**Improvement:** Check response body, side effects, database state
**Learning Value:** Testing discipline
```typescript
// Current:
expect(response.statusCode).toBe(200);

// Better:
expect(response.statusCode).toBe(200);
const body = response.json();
expect(body.data.username).toBe('testuser');
expect(body.data).not.toHaveProperty('password_hash');
const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
expect(user.last_seen).toBeDefined();
```

---

## 💼 Interview Prep - Concepts You Should Be Able to Explain

1. **Database Transactions** - ACID properties, when to use, how they work
2. **JWT vs Session Auth** - Tradeoffs, stateless vs stateful, token storage
3. **OAuth Flow** - Why state param, why redirect, security concerns
4. **Password Security** - Why bcrypt, what is salting, rainbow tables
5. **Rate Limiting** - Per-user vs global, sliding window vs fixed window
6. **Error Handling** - Try-catch patterns, error context, global handlers
7. **Validation vs Sanitization** - XSS, SQL injection (you're using parameterized queries ✓)
8. **API Design** - REST principles, status codes, pagination, versioning
9. **Type Safety** - `any` vs `unknown` vs `never`, generics, type narrowing
10. **Async Patterns** - Promises vs async/await, error handling, Promise.all vs sequential

---

## 📊 Effort vs Impact Matrix

| Priority | Task | Effort | Impact | Learn Value |
|----------|------|--------|--------|-------------|
| P0 | Fix token refresh race condition | 30min | 🔥🔥🔥 | ⭐⭐⭐ |
| P0 | Fix `any[]` to `unknown[]` | 5min | 🔥🔥 | ⭐⭐⭐ |
| P1 | Add request correlation IDs | 30min | 🔥🔥 | ⭐⭐⭐ |
| P1 | Fix health check | 5min | 🔥🔥 | ⭐ |
| P1 | Remove useless try-catch | 5min | 🔥 | ⭐ |
| P1 | Move getAvatarUrl to service | 10min | 🔥🔥 | ⭐⭐ |
| P1 | Parallel route registration | 5min | 🔥 | ⭐ |
| P1 | Add error context | 15min | 🔥🔥🔥 | ⭐⭐ |
| P2 | Learn & implement transactions | 3hr | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| P2 | Password complexity validation | 10min | 🔥🔥 | ⭐⭐ |
| P2 | Per-user rate limiting | 1hr | 🔥🔥 | ⭐⭐⭐ |
| P3 | Pagination limits | 5min | 🔥 | ⭐ |
| P3 | Better test assertions | 2hr | 🔥 | ⭐⭐⭐ |
| P3 | Account lockout | 2hr | 🔥 | ⭐⭐⭐ |

---

## 🎯 Recommended Order

**Weekend Sprint (4-6 hours):**
1. Fix token refresh race (30min) ← CRITICAL
2. Fix `any[]` types (5min) ← CRITICAL  
3. Remove useless try-catch (5min)
4. Fix health check (5min)
5. Add error context (15min)
6. Move getAvatarUrl (10min)
7. Parallel routes (5min)
8. Password complexity (10min)
9. Pagination limits (5min)
10. **Learn transactions** (3hr) ← HIGHEST LEARNING VALUE
11. Implement transaction in refresh endpoint (15min)

**After That:**
- Request correlation IDs (30min)
- Per-user rate limiting (1hr)
- Better test assertions (2hr - do this gradually)
- Account lockout (2hr - optional, good learning)

---

## 🤓 Final Thoughts

**What Makes This a 7/10:**
- ✅ You understand concepts (JWT, OAuth, 2FA, testing)
- ✅ Code structure is solid
- ❌ Missing production fundamentals (transactions, error context, monitoring)
- ❌ Some over-engineering (createHandler) mixed with under-engineering (no transactions)

**To Get to 8.5/10:**
Fix P0 items + learn transactions + add request IDs = you're showing you understand *why* patterns exist, not just copying them

**What Interviewers Look For:**
Not "did you implement every pattern" but "do you understand tradeoffs and make intentional decisions"
- Why use transactions here but not there?
- Why rate limit per-user vs global?
- When is abstraction helpful vs over-engineering?

You're showing good instincts. The gap is experience with production issues. These fixes teach you those lessons without needing to learn them the hard way.
