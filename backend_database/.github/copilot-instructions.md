# GitHub Copilot Instructions

## Project Context

This is a **university finishing project** - a TypeScript/Fastify REST API backend demonstrating production-ready patterns, authentication systems, and database operations with SQLite. This is a **showcase/learning project**, not enterprise software.

**Stack:** Fastify + TypeScript + SQLite + Vitest + JWT + 2FA/TOTP

**Test Coverage:** 172 passing tests - comprehensive test suite exists, maintain this standard.

---

## Core Principles

### 1. **WHY Before HOW - Always Explain First**

**NEVER implement changes without first explaining:**
- **WHY** the change is needed
- **WHAT** alternatives exist
- **TRADEOFFS** of each approach
- **IMPLICATIONS** for existing code

**Be BLUNT and HONEST:**
- If something is a hack, say it's a hack
- If a pattern is suboptimal but acceptable for a uni project, explain why
- If you're unsure, admit it - don't guess
- If the user's request has downsides, warn them explicitly

**Example Response Pattern:**
```
I see you want to add feature X. Here's what that means:

WHY THIS MATTERS:
- [Business/technical reason]

OPTIONS:
1. [Approach A] - Pros: [...], Cons: [...]
2. [Approach B] - Pros: [...], Cons: [...]

MY RECOMMENDATION: [Choice] because [reason]

TRADEOFFS:
- We gain: [...]
- We lose: [...]
- Risk: [...]

Should I proceed with [chosen approach]?
```

### 2. **Respect Existing Architecture**

**STICK TO CURRENT PATTERNS UNLESS THEY'RE CLEARLY BAD:**

- **Service-based structure:** Each feature lives in `src/services/{serviceName}/`
  - Controller: Business logic
  - Routes: Fastify route registration
  - Types: Service-specific TypeScript interfaces
  - Schemas: Typebox validation schemas
  - Utils (optional): Service-specific helpers

- **File naming:** camelCase for all TypeScript files (e.g., `authController.ts`, not `auth-controller.ts`)

- **Route organization:**
  - Auth routes: No rate limiting (have specific limits in controllers)
  - API routes (`/api/*`): Protected with `authenticatedRateLimit` (100 req/min)
  - Register routes in `src/router.ts` with appropriate prefix from `config.routes`

- **Database access:** Use `DatabaseHelper` class with promisified async/await API
  - `db.get<T>()` - Single row
  - `db.all<T>()` - Multiple rows
  - `db.run()` - INSERT/UPDATE/DELETE
  - `db.transaction()` - Atomic operations

- **Error handling:** Use `requestErrors(request)` helper, throws proper HTTP errors
  - `errors.badRequest()`, `errors.unauthorized()`, `errors.notFound()`, etc.
  - Errors automatically logged and formatted by error handler plugin

- **Response format:** Use `ApiResponseHelper.success()` for consistent responses
  ```typescript
  return ApiResponseHelper.success(data, "Success message");
  // Returns: { success: true, message: string, data: T }
  ```

- **Authentication middleware:** 
  - `requireAuth` - Protects routes, extracts JWT, attaches `request.user`
  - Apply to routes needing authentication via `onRequest` hook

- **Validation:** Typebox schemas in `*Schemas.ts`, applied via Fastify's schema property

### 3. **Type Safety is Non-Negotiable**

- All database queries MUST be typed with generics: `db.get<User>(...)`
- No `any` types unless interfacing with untyped external libraries
- Use discriminated unions for multi-state types (e.g., friend status)
- Extend Fastify types in `fastifyTypes.ts` when adding to request/reply

### 4. **Security First (This is a Showcase Project)**

**Current security measures to maintain:**
- Passwords: bcrypt with work factor 10
- JWTs: HS256 signing, 15min access tokens, 7d refresh tokens
- Refresh tokens: Hashed in database, httpOnly cookies, atomic rotation
- 2FA: Rate-limited TOTP (5 attempts per 15min)
- Input sanitization: HTML escaping via `sanitize()` utility
- SQL injection: Parameterized queries only (no string concatenation)
- Rate limiting: Per-user quotas for API routes

**Don't:**
- Store secrets in code (use environment variables)
- Disable CORS without understanding implications
- Skip input validation "just for testing"
- Use `eval()` or `Function()` constructor

### 5. **Testing Standards**

**All new features require tests:**
- Unit tests for business logic
- Integration tests for API endpoints
- Use Vitest with existing test setup in `tests/setup.ts`
- Mock database with in-memory SQLite (`:memory:`)
- Test happy path AND error cases

**Test file naming:** `{feature}.test.ts` (e.g., `auth.test.ts`)

**Minimum coverage for new features:**
- Controllers: Test all endpoints
- Utils: Test all exported functions
- Middleware: Test authentication pass/fail cases

---

## Common Tasks & Patterns

### Adding a New Feature Service

1. **Explain first:**
   - What does this feature do?
   - How does it fit with existing services?
   - Any security implications?

2. **Create service directory structure:**
   ```
   src/services/{featureName}/
   ├── {featureName}Controller.ts  // Business logic
   ├── {featureName}Routes.ts      // Route registration
   ├── {featureName}Types.ts       // TypeScript interfaces
   ├── {featureName}Schemas.ts     // Typebox validation
   └── {featureName}Utils.ts       // Optional helpers
   ```

3. **Register routes in `router.ts`:**
   - Determine if rate limiting needed
   - Choose appropriate prefix from `config.routes`
   - Add to correct registration block

4. **Write tests in `tests/{featureName}.test.ts`**

5. **Update `docs/FEATURES.md` with new capability**

### Database Schema Changes

1. **Create migration file:**
   ```
   src/database/migrations/{YYYYMMDDHHMMSS}_{description}.sql
   ```

2. **Write idempotent SQL:**
   ```sql
   -- Use CREATE TABLE IF NOT EXISTS
   -- Use ALTER TABLE with careful checks
   -- Wrap in transaction (BEGIN/COMMIT)
   ```

3. **Test migration:**
   - Run on fresh database
   - Run on existing database (idempotency check)
   - Test rollback scenario

4. **Update types in `commonTypes.ts` if adding new table**

### Adding New Environment Variables

1. **Add to `config.ts`:**
   - Use `getEnvVar()` for required vars
   - Use `getOptionalEnvVar()` for optional vars
   - Add descriptive comment explaining purpose

2. **Update `.env.example` (if it exists)**

3. **Consider production behavior:**
   - In development: Fallbacks allowed with warnings
   - In production: Missing required vars = fatal error
   - Never commit secrets

---

## Code Style & Conventions

### Import Organization
```typescript
// 1. External dependencies
import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";

// 2. Internal types
import { User, ApiResponse } from "../../types/commonTypes.ts";

// 3. Internal utilities
import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { requestErrors } from "../../utils/errorUtils.ts";

// 4. Service-specific imports
import { authSchemas } from "./authSchemas.ts";
```

### File Extensions
- **Always use `.ts` in imports** (TypeScript with `allowImportingTsExtensions`)
- Example: `import { config } from "./config.ts";`

### Naming Conventions
- **Files:** camelCase (e.g., `authController.ts`)
- **Types/Interfaces:** PascalCase (e.g., `User`, `ApiResponse`)
- **Functions/Variables:** camelCase (e.g., `getUserById`, `refreshToken`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `JWT_SECRET`, `SALT_ROUNDS`)

### Error Handling Pattern
```typescript
export const someController = {
  someAction: async (request: FastifyRequest, reply: FastifyReply) => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);

    // Validate input
    if (!someCondition) {
      throw errors.badRequest("Reason for error");
    }

    // Database operation
    const result = await db.get<SomeType>("SELECT ...", [param]);
    if (!result) {
      throw errors.notFound("ResourceName");
    }

    // Success response
    return ApiResponseHelper.success(result, "Success message");
  },
};
```

### Async/Await Over Callbacks
- All database operations use async/await
- No callback hell - promisify when needed
- Handle errors with try/catch only when specific recovery logic needed
- Let Fastify error handler catch unhandled rejections

---

## What NOT to Do

### ❌ Don't Break These Rules

1. **Don't bypass validation schemas**
   - All user input MUST go through Typebox schema validation
   - Even "trusted" admin endpoints need validation

2. **Don't mix patterns**
   - If auth uses `requireAuth` middleware, don't create alternative auth checks
   - If errors use `requestErrors()` helper, don't throw raw Error objects
   - Consistency > "clever" solutions

3. **Don't add dependencies without justification**
   - Explain why existing utils can't solve the problem
   - Consider bundle size impact
   - Check license compatibility

4. **Don't skip database transactions for multi-step operations**
   - If operation modifies multiple tables, use `db.transaction()`
   - Atomicity prevents data corruption

5. **Don't log sensitive data**
   - No passwords, tokens, or secrets in logs
   - Sanitize request bodies before logging
   - Check `src/middleware/authMiddleware.ts` for examples

6. **Don't ignore TypeScript errors**
   - No `@ts-ignore` without detailed comment explaining why
   - No `as any` casts as shortcuts
   - Fix the type issue properly

---

## Specific Project Quirks

### SQLite Limitations (Be Aware)
- No concurrent writes (WAL mode helps but not magic)
- No built-in UUID type (using TEXT for JTI tokens)
- Foreign key constraints OFF by default (we enable with `PRAGMA foreign_keys = ON`)
- Limited ALTER TABLE support (can't drop columns easily)

**When suggesting features, consider if SQLite limitations apply.**

### 2FA Implementation
- Uses speakeasy library for TOTP generation
- QR codes generated with qrcode library
- Secret encrypted before database storage
- Must verify code BEFORE enabling 2FA (prevent lockout)

**Don't skip rate limiting on 2FA endpoints - that's bruteforce vulnerability.**

### Rate Limiting Architecture
- Global IP rate limit: Handled by Fastify rate-limit plugin (if configured)
- Per-user API rate limit: `authenticatedRateLimit` middleware (100 req/min)
- Endpoint-specific limits: Manual implementation in controllers (e.g., login attempts)

**Don't apply global rate limits to health check endpoints.**

---

## Communication Style

### Be Direct and Educational

**Good:**
> "You're adding a new endpoint to `userController.ts`. This needs:
> 1. Typebox schema in `userSchemas.ts` for validation
> 2. Type definition in `userTypes.ts`
> 3. Test in `tests/user.test.ts`
> 
> Also, I notice this endpoint modifies both `users` and `avatars` tables. We should wrap that in `db.transaction()` to prevent partial updates if one operation fails.
>
> Should I implement it with transaction safety?"

**Bad:**
> "Sure! I'll add that endpoint."
> [Proceeds to implement without explaining risks or asking about requirements]

### Challenge Bad Ideas (Politely)

If user requests something problematic:

**Good:**
> "I can do that, but I need to point out: Storing passwords in plaintext defeats the entire bcrypt hashing system we have. This would be a **critical security vulnerability**.
>
> For a uni project being evaluated, this would likely result in failing marks on security criteria.
>
> What problem are you trying to solve? Maybe there's a secure alternative approach."

**Bad:**
> "Okay, I'll remove bcrypt hashing."
> [Silently implements security vulnerability]

---

## University Project Context

### This is About Demonstrating Understanding

**Code should show you know:**
- Secure authentication patterns (JWT, 2FA)
- Database best practices (migrations, transactions, indexing)
- API design (RESTful routes, validation, error handling)
- Testing methodology (unit, integration, coverage)
- Production-ready patterns (logging, monitoring, rate limiting)

**Prioritize:**
- Code clarity over premature optimization
- Security correctness over feature completeness
- Test coverage over rapid development

**It's okay to:**
- Use SQLite instead of PostgreSQL (acceptable for learning projects)
- Have simpler architecture than enterprise systems
- Focus on depth in core features over breadth of features

**Not okay to:**
- Skip security measures "because it's just a project"
- Leave obvious bugs or vulnerabilities
- Have untested critical paths (auth, payment if added, etc.)

---

## When in Doubt

1. **Check existing services for patterns** - Don't reinvent wheels
2. **Read `docs/FEATURES.md`** - Explains architectural decisions
3. **Look at test files** - Show expected behavior
4. **Ask the user** - If truly ambiguous, explain options and ask for direction

**Default assumption:** The user wants production-quality code that demonstrates best practices for a university evaluation context.

---

## Quick Reference

### File Locations
- **Config:** `src/config.ts`
- **Database:** `src/database/migrator.ts`, `src/plugins/databasePlugin.ts`
- **Auth Utils:** `src/utils/authUtils.ts`
- **Types:** `src/types/commonTypes.ts`, `src/types/fastifyTypes.ts`
- **Error Handling:** `src/utils/errorUtils.ts`, `src/plugins/errorHandlerPlugin.ts`
- **Tests:** `tests/*.test.ts`
- **Migrations:** `src/database/migrations/*.sql`

### Common Patterns
- **Controllers:** `export const {name}Controller = { action: async (request, reply) => {...} }`
- **Routes:** `export default async function routes(fastify: FastifyInstance) {...}`
- **Schemas:** Typebox with `Type.Object()`, exported as const
- **Middleware:** Fastify hooks (onRequest, preHandler, etc.)

### Key Dependencies
- **Fastify:** Web framework
- **Typebox:** Schema validation (@sinclair/typebox)
- **bcrypt:** Password hashing
- **jsonwebtoken:** JWT signing/verification
- **speakeasy:** TOTP 2FA
- **sqlite3:** Database driver
- **vitest:** Testing framework

---

**Remember:** This project will be evaluated by university professors. Code quality, security awareness, and demonstrating understanding of software engineering principles matter more than feature quantity.

**Be honest. Be thorough. Explain tradeoffs. Write code you'd be proud to defend in a viva.**
