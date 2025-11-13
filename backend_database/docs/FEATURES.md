# Project Features & Technical Considerations

**Project Type:** Fastify TypeScript Backend - Showcase/Learning Project  
**Database:** SQLite  
**Test Coverage:** 172 passing tests

---

## 🔐 Authentication & Authorization

### JWT Token System
- **Access Tokens:** Short-lived (15min), signed with HS256
- **Refresh Tokens:** Long-lived (7d), bcrypt-hashed storage in database
- **Token Rotation:** New refresh token on each refresh, old token invalidated
- **Revocation Support:** Database flag for manual token invalidation
- **Cookie Storage:** httpOnly cookies for refresh tokens (XSS protection)

### Password Security
- **bcrypt Hashing:** Work factor 10, built-in salting
- **No Plaintext Storage:** Passwords never stored in plain text
- **Why bcrypt?** Intentionally slow (prevents brute force), auto-salting (prevents rainbow tables)

### OAuth 2.0 Integration
- **Providers:** GitHub, Google
- **CSRF Protection:** State parameter with HMAC verification
- **OAuth State Secrets:** Time-limited, signed state tokens
- **Auto User Creation:** First-time OAuth login creates account
- **Avatar Fetching:** Automatic profile picture import from OAuth providers
- **Account Linking:** Links OAuth identity to existing email if found

### Two-Factor Authentication (2FA/TOTP)
- **Algorithm:** Time-based One-Time Password (RFC 6238)
- **QR Code Generation:** For authenticator apps (Google Authenticator, Authy)
- **Secret Storage:** Encrypted in database, only enabled after verification
- **Rate Limiting:** 5 attempts per 15 minutes
- **Account Lockout:** After failed attempts
- **Endpoints:** Setup, enable, disable, verify

### Middleware
- **requireAuth:** Verifies JWT access token, blocks unauthenticated requests
- **optionalAuth:** Attaches user if token present, continues otherwise (unused currently)
- **Request Context:** Automatically injects user ID, request ID for logging

---

## 🗄️ Database & Persistence

### Database Migrations
- **Version Control:** Timestamp-prefixed SQL files (YYYYMMDDHHMMSS_description.sql)
- **Atomic Execution:** Wrapped in transactions (all-or-nothing)
- **Migration Tracking:** `schema_migrations` table tracks applied migrations
- **Idempotent Runner:** Safe to run multiple times
- **Automatic Execution:** Runs on application startup
- **Fail-Fast:** App won't start if migration fails

**ACID Properties Demonstrated:**
- **Atomicity:** Transactions ensure complete success or complete rollback
- **Consistency:** Foreign key constraints maintain referential integrity
- **Isolation:** SQLite WAL mode for concurrent reads
- **Durability:** Disk-backed persistence

### Schema Design
- **users:** Core account table with OAuth support, 2FA fields, timestamps
- **refresh_tokens:** JTI, user_id, hashed token, revocation flag, expiration
- **matches:** Game records with winner/loser foreign keys, scores, timestamps
- **avatars:** File metadata (path, URL, MIME type, size) with user foreign key
- **friends:** Friendship relationships with inviter tracking, status (pending/accepted/declined)

**Indexes for Performance:**
- `idx_refresh_tokens_user` - Fast user token lookups
- `idx_avatars_user_id` - User avatar queries
- `idx_friends_user1`, `idx_friends_user2` - Bidirectional friend lookups
- `idx_friends_status` - Filter by friendship status

### Transaction Support
- **Implemented via db.transaction()** - Promisified SQLite transactions
- **Used in:**
  - OAuth login/registration (atomic user creation + token generation)
  - Token refresh (delete old + create new atomically)
  - Avatar uploads (database record + file operation coordination)
  - Friend operations (status update + timestamp update)

**Pattern:**
```typescript
await db.transaction(async (tx) => {
  await tx.run("INSERT ...");
  await tx.run("UPDATE ...");
  // Both succeed or both rollback
});
```

### Database Utilities
- **Promisified API:** Converts SQLite callbacks to Promises
- **Type-Safe Queries:** `get<T>()`, `all<T>()`, `run()` with TypeScript generics
- **DatabaseHelper Class:** Wraps sqlite3.Database with async methods

---

## 🔒 Security Measures

### Input Validation & Sanitization
- **JSON Schema Validation:** All endpoints validated before handler execution
- **HTML Entity Escaping:** Prevents stored XSS attacks
- **Email Normalization:** Consistent format (lowercase, trimmed)
- **Username Sanitization:** Whitespace trim, HTML escape
- **SQL Injection Prevention:** Parameterized queries everywhere (no string concatenation)

**Defense in Depth:**
1. Schema validation (format, length, required fields)
2. Sanitization (escape HTML, normalize data)
3. Parameterized queries (SQL injection prevention)
4. Frontend output encoding (React auto-escapes)

### Rate Limiting
- **Global (Unauthenticated):** 20 requests/second via @fastify/rate-limit
- **Authenticated API:** 100 requests/minute per user
- **Auth Endpoints:** 5 requests/5 minutes (login, register)
- **2FA Verification:** 5 attempts/15 minutes with account lockout
- **Tracking:** Per-user for authenticated, per-IP for public
- **Storage:** In-memory Map (documented Redis upgrade path)

**Real-World Impact:**
- Prevents brute force attacks on auth endpoints
- DoS protection for public endpoints
- Per-user fairness (one user can't starve others)

### CORS Configuration
- **Allowed Origins:** Configurable via `CORS_ORIGINS` env var
- **Credentials:** Enabled (allows cookies)
- **Methods:** GET, POST, PATCH, PUT, DELETE, OPTIONS
- **Preflight Handling:** Automatic OPTIONS response

### Cookie Security
- **httpOnly:** JavaScript cannot access (XSS protection)
- **Secure:** HTTPS-only in production
- **SameSite:** CSRF protection
- **Refresh Token Storage:** Never exposed to JavaScript

### File Upload Security
- **Size Limit:** 5MB max per file
- **File Count:** 1 file per request
- **MIME Type Validation:** Only image/jpeg, image/png, image/gif
- **Unique Filenames:** UUID-based to prevent overwrites
- **Path Traversal Prevention:** Validates upload directory

---

## 👤 User Management

### User Profiles
- **Unique Constraints:** Username and email enforced at database level
- **Profile Retrieval:** GET /api/users/:id with avatar URL
- **Avatar Management:** Upload, retrieve, default assignment
- **Last Seen Tracking:** Updated on heartbeat endpoint
- **Timestamps:** created_at, updated_at on all records

### Avatar System
- **Upload:** Multipart/form-data with file validation
- **Storage:** Filesystem at `/uploads/avatars/`
- **Default Avatars:** Automatic assignment on registration
- **URL Generation:** Public host + port + path configuration
- **Database Metadata:** Tracks file_path, file_url, mime_type, file_size
- **Cleanup:** Old avatars deleted on new upload (with TODO for proper utility)

### Friend System
- **Send Requests:** POST /api/users/friends/:id
- **Accept/Decline:** PATCH /api/users/friends/:id with status
- **Remove Friends:** DELETE /api/users/friends/:id
- **List Friends:** GET /api/users/friends with status filtering
- **Friend Details:** GET /api/users/friends/:id including inviter info
- **Inviter Tracking:** Records who initiated the friendship
- **Online Status:** last_seen timestamp tracking
- **Heartbeat:** PATCH /api/users/:id/heartbeat for presence updates

**Bidirectional Relationship:**
- Friends stored with user1_id < user2_id constraint
- Queries check both user1_id and user2_id positions
- Ensures no duplicate friendships

---

## 🎮 Match Tracking

### Match Recording
- **Create Matches:** POST /api/matches with winner/loser/scores
- **Validation:**
  - Winner and loser must exist in database
  - Scores must be positive integers
  - All fields required
- **Timestamp:** Automatic played_at timestamp

### Match Retrieval
- **By Username:** GET /api/matches/:username
- **Ordering:** Chronological (newest first)
- **Empty Results:** Returns empty array (not 404) when no matches
- **User Validation:** 404 if username doesn't exist

---

## 📊 API Design & Documentation

### RESTful API Structure
- **Consistent URL Patterns:** `/api/resource` and `/api/resource/:id`
- **HTTP Methods:** GET (read), POST (create), PATCH (partial update), DELETE (remove)
- **Status Codes:**
  - 200: Success
  - 201: Created
  - 400: Validation error
  - 401: Unauthorized (missing/invalid token)
  - 403: Forbidden (valid token, insufficient permissions)
  - 404: Not found
  - 409: Conflict (duplicate resource)
  - 500: Internal server error

### Response Format Standardization
- **ApiResponseHelper:** Centralized response builder
- **Success Format:**
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Optional message",
    "timestamp": "2025-11-11T13:43:27.000Z"
  }
  ```
- **Error Format:**
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable message"
    },
    "timestamp": "2025-11-11T13:43:27.000Z"
  }
  ```
- **Pagination Support:** Helper method exists (not yet used in endpoints)

### Swagger/OpenAPI Documentation
- **Auto-Generated:** From JSON schemas
- **Interactive UI:** Available at `/docs` in development
- **Bearer Token Auth:** Built-in authentication UI
- **Organized Tags:** health, auth, oauth, users, matches, friends
- **Development Only:** Disabled in production for security

### Schema Definitions
- **JSON Schema:** Used for request/response validation
- **Swagger Integration:** Same schemas generate documentation
- **Reusable Components:** Shared schema definitions in `schemaUtils.ts`
- **Type Safety:** TypeScript interfaces match schemas

---

## 📝 Logging & Observability

### Structured Logging (Pino)
- **Format:** JSON in production, pretty-print in development
- **Log Levels:** trace, debug, info, warn, error, fatal
- **Configurable:** `LOG_LEVEL` environment variable
- **Context Injection:** Automatic request context in all logs
- **User Tracking:** User ID included in logs when authenticated
- **Error Context:** AppError context object logged on failures

**Structured Format Example:**
```json
{
  "level": "error",
  "time": 1699714407000,
  "reqId": "req-12345",
  "userId": 42,
  "url": "/api/users/42",
  "method": "GET",
  "error": "User not found",
  "context": { "targetUserId": 42 }
}
```

### Request Tracing
- **Unique Request IDs:** Format `req-{timestamp}-{random}`
- **X-Request-Id Header:** Client can provide or server generates
- **Correlation:** Same ID appears in all logs for a request
- **Distributed Tracing Ready:** Can be extended to microservices

### Health Checks
- **Endpoint:** GET /health
- **Database Check:** Verifies SQLite connectivity
- **Docker Healthcheck:** Integrated with container orchestration
- **Response Format:** Status + uptime + database status

---

## 🏗️ Architecture & Patterns

### Plugin-Based Architecture
- **Fastify Plugins:** Using `fastify-plugin` for encapsulation
- **Database Plugin:** Registers db on fastify instance
- **Error Handler Plugin:** Global error handling
- **Modular Registration:** Plugins registered in main.ts

### Service-Based Organization
```
services/
  authService/
    authController.ts   - Business logic
    authRoutes.ts       - Route definitions
    authSchemas.ts      - JSON schemas
    authTypes.ts        - TypeScript types
```
- **Self-Contained:** Each service has all its files
- **Clear Separation:** Controller (logic) vs Routes (registration) vs Schemas (validation)
- **Scalable:** Easy to add new services

### Error Handling Strategy
- **AppError Class:** Custom error with statusCode, code, message, context
- **Factory Functions:** `errors.validation()`, `errors.notFound()`, etc.
- **Request-Aware Builders:** `requestErrors(request)` auto-injects context
- **Global Handler:** Catches all errors, logs, and formats response
- **Consistent Responses:** All errors follow same format

### Configuration Management
- **Environment Variables:** All config from env vars
- **Validation:** Fail-fast on startup if required vars missing
- **Dev vs Prod:** Development allows fallbacks, production requires explicit values
- **Centralized:** Single config.ts exports typed config object
- **Type Safety:** No magic strings, all config accessed via imports

---

## 🧪 Testing Infrastructure

### Test Suite (Vitest)
- **172 Passing Tests** across 7 test files
- **Test Files:**
  - auth.test.ts (25 tests) - Registration, login, refresh, logout
  - user.test.ts (37 tests) - Profile CRUD, avatars
  - match.test.ts (10 tests) - Match creation, retrieval
  - friend.test.ts (52 tests) - Requests, accept/decline, status, online presence
  - oauth.test.ts (16 tests) - GitHub OAuth flow
  - health.test.ts (1 test) - Health endpoint
  - sanitization.test.ts (31 tests) - Input sanitization

### Test Coverage Areas
- **Happy Paths:** Successful operations
- **Validation:** Required fields, format validation
- **Error Scenarios:** 404s, 409 conflicts, 401 unauthorized
- **Edge Cases:** Empty results, duplicate operations
- **Security:** Token validation, rate limiting (partial)

### Test Utilities
- **createTestApp():** Builds isolated Fastify instance per test suite
- **cleanupTestApp():** Proper teardown (close server, close DB)
- **resetDatabase():** Clears data between tests
- **In-Memory SQLite:** Fast test execution (`:memory:`)
- **Rate Limit Disabling:** Tests run without rate limit interference

---

## 🐳 Deployment & DevOps

### Docker Support
- **Multi-Stage Build:** Separate builder and production stages
- **Base Image:** node:18.20.5-alpine (minimal size)
- **Non-Root User:** Runs as nodejs user (UID 1001)
- **Health Checks:** Built-in container health monitoring
- **Volume Support:** Database persists in `/app/data`
- **Environment Config:** All configuration via env vars
- **Security:** No dev dependencies in production image

### Build System
- **TypeScript Compilation:** tsup with ES modules
- **Minification:** Production builds minified
- **Hot Reload:** tsx watch mode in development
- **Clean Builds:** `npm run clean` removes dist/
- **Fast Development:** tsx for instant TypeScript execution

### Code Quality Tools
- **ESLint:** TypeScript-specific rules
- **Prettier:** Consistent code formatting
- **Pre-Commit Hooks:** husky + lint-staged
- **Enforced Rules:**
  - `no-console` error (use logger instead)
  - `@typescript-eslint/no-unused-vars` warn
  - `@typescript-eslint/no-explicit-any` warn
  - `no-var` error

---

## 🎨 Frontend Integration Ready

### CORS Configuration
- **Multiple Origins:** Comma-separated in `CORS_ORIGINS` env var
- **Credentials Enabled:** Allows cookies to be sent
- **Preflight Support:** Handles OPTIONS requests

### Cookie-Based Refresh Tokens
- **Browser Compatible:** Works with fetch credentials: 'include'
- **Automatic Sending:** Browser sends cookie on every request
- **httpOnly:** JavaScript cannot access token (secure)

### Static File Serving
- **Avatar Serving:** GET /uploads/avatars/:filename
- **Public URL Config:** `PUBLIC_HOST`, `PUBLIC_PORT`, `PUBLIC_PROTOCOL`
- **Production Ready:** Handles absolute URLs for different environments

---

## 📚 Documentation

### Code Documentation
- **Inline Comments:** Explain WHY, not WHAT
- **Concept Explanations:** Key files have educational comments
- **Migration Runner:** Full ACID property explanation
- **Sanitization Utils:** XSS prevention explained
- **Rate Limiting:** Brute force attack mitigation explained

### External Documentation
- **README.md:** Quick start, API overview, tech stack
- **LOGGING.md:** Complete Pino logging guide with examples
- **OAuth Guides:**
  - OAUTH_QUICKSTART.md - Fast setup
  - OAUTH_SETUP_GUIDE.md - Detailed provider configuration
  - OAUTH_TEST_SUMMARY.md - OAuth testing results
- **Copilot Instructions:** Comprehensive project context (this file)

---

## 🔧 Advanced Concepts Demonstrated

### ACID Properties
- **Atomicity:** Transaction wrapping for multi-step operations
- **Consistency:** Foreign key constraints, unique constraints
- **Isolation:** SQLite locking, WAL mode for concurrent reads
- **Durability:** Synchronous disk writes, fsync calls

### Security Best Practices
- **Defense in Depth:** Multiple validation layers
- **Principle of Least Privilege:** Non-root container user, minimal permissions
- **Secure Token Storage:** Hashed refresh tokens, httpOnly cookies
- **Rate Limiting:** Prevents brute force attacks
- **Input Sanitization:** XSS prevention

### Observability Principles
- **Correlation IDs:** Track requests across system
- **Structured Logging:** Machine-parseable logs
- **Health Checks:** Liveness and readiness probes
- **Error Context:** Rich debugging information
- **Request Tracking:** User ID, endpoint, timing in logs

### API Versioning Readiness
- **Prefix-Based Routing:** `/api`, `/auth` prefixes
- **Centralized Registry:** Easy to add `/api/v2`
- **Backward Compatibility:** Versioned schemas possible

### Graceful Degradation
- **Optional OAuth:** App works without OAuth configured
- **Optional 2FA:** Users can opt-in to 2FA
- **Default Avatars:** System functions without user uploads

### Type Safety Throughout
- **Generic Types:** Request/response typing with generics
- **Strict TypeScript:** No implicit any, strict null checks
- **Type Guards:** Runtime type validation where needed
- **Schema Inference:** Types derived from schemas

---

## 🚨 Known Limitations

### Not Production-Scale Ready
- **SQLite:** Single-writer bottleneck (Postgres/MySQL for scale)
- **In-Memory Rate Limiting:** Doesn't work across multiple instances (needs Redis)
- **No Connection Pooling:** SQLite opened once globally
- **No Graceful Shutdown:** In-flight requests killed on deploy
- **No Request Timeouts:** Long queries can hang indefinitely

### Missing Features (Intentionally Out of Scope)
- **Email Verification:** User accounts not verified
- **Password Reset:** No forgot-password flow
- **Admin Dashboard:** No administrative interface
- **Websockets:** Real-time features not implemented
- **Background Jobs:** No queue system (e.g., async email)
- **Caching Layer:** No Redis cache
- **Soft Deletes:** Hard deletes lose audit trail
- **Database Backups:** No automated backup strategy
- **Monitoring/Alerting:** No Prometheus/Grafana integration

---

## 📈 Future Enhancement Paths

### Immediate Improvements
1. **Add pagination** to match/friend list endpoints
2. **Implement graceful shutdown** (SIGTERM handling)
3. **Add request timeouts** to prevent hung connections
4. **Transaction consistency** across all multi-step operations

### Scalability Upgrades
1. **Swap SQLite for PostgreSQL** (connection pooling, concurrent writes)
2. **Add Redis** for rate limiting and session storage
3. **Implement caching** for frequently accessed data
4. **Add CDN** for avatar serving

### Feature Additions
1. **Email verification** with token-based activation
2. **Password reset** flow
3. **Websockets** for real-time friend status
4. **Admin API** for user management
5. **Audit logging** for compliance
6. **Background job queue** (Bull/BullMQ)

### Observability
1. **Prometheus metrics** endpoint
2. **Grafana dashboards** for monitoring
3. **Error tracking** (Sentry integration)
4. **APM tracing** (OpenTelemetry)

---

## 🎓 Learning Outcomes

This project demonstrates understanding of:

✅ **Backend Architecture** - Service-based design, separation of concerns  
✅ **Authentication** - JWT, OAuth 2.0, 2FA, secure token storage  
✅ **Database Design** - Normalization, foreign keys, indexes, migrations  
✅ **Security** - XSS prevention, SQL injection prevention, rate limiting, CSRF protection  
✅ **Testing** - Integration testing, test isolation, fixture management  
✅ **API Design** - RESTful principles, consistent responses, proper status codes  
✅ **DevOps** - Docker, multi-stage builds, health checks, non-root users  
✅ **Type Safety** - TypeScript generics, strict typing, schema validation  
✅ **Observability** - Structured logging, request tracing, error context  
✅ **Code Quality** - Linting, formatting, pre-commit hooks

---

**Project Scale:** Showcase/learning project (not enterprise production)  
**Target Audience:** Junior/mid-level backend developer interviews  
**Completion Date:** November 2025
