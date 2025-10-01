# Test Summary - Match Route Fixes

## Overview

All match route tests are now passing. Fixed validation logic and status code issues in the match service.

## Test Results

```
✓ tests/health.test.ts (2 tests)
✓ tests/auth.test.ts (9 tests)
✓ tests/user.test.ts (6 tests)
✓ tests/match.test.ts (10 tests)

Total: 27 tests passed
```

## Changes Made

### 1. Fixed Match Schema Validation (`src/services/matchService/matchSchemas.ts`)

**Issue**: Schema had incorrect validation rules:

- `winner_score` had `maximum: 12` constraint (test used scores up to 21)
- Negative scores weren't properly validated

**Fix**: Updated schema to:

```typescript
winner_score: {type: "number", minimum: 0}  // Removed maximum constraint
loser_score: {type: "number", minimum: 0}   // Added minimum: 0
```

### 2. Fixed Match Controller Logic (`src/services/matchService/matchController.ts`)

#### Issue 1: Status Code for POST /matches

**Problem**: Route didn't return 201 (Created) status for successful match creation
**Fix**: Added `reply.status(201)` before returning success response

#### Issue 2: GET /matches/:username with No Matches

**Problem**: Controller threw 404 error when user had no matches
**Expected**: Return 200 with empty array
**Fix**: Removed the error throw for empty matches array

#### Issue 3: GET /matches/:username for Non-Existent User

**Problem**: Controller didn't validate if user exists before querying matches
**Expected**: Return 404 for non-existent users
**Fix**: Added user existence check before querying matches:

```typescript
const userExists = await db.get<{ count: number }>(
  `SELECT COUNT(*) as count FROM users WHERE username = ?`,
  [username]
);
if (!userExists || userExists.count === 0) {
  throw errors.notFound("User not found");
}
```

## Test Coverage

### Match Service Tests (10 tests)

1. ✓ POST /matches should create a match
2. ✓ POST /matches should validate required fields
3. ✓ POST /matches should validate winner exists
4. ✓ POST /matches should validate loser exists
5. ✓ POST /matches should validate scores are positive
6. ✓ GET /matches/:username should return user matches
7. ✓ GET /matches/:username should return empty array for no matches
8. ✓ GET /matches/:username should return 404 for non-existent user
9. ✓ GET /matches/:username should order matches by date (newest first)
10. ✓ POST /matches should handle same player winning/losing multiple times

### Other Services

- **Auth Service**: 9 tests passing (register, login, refresh, logout)
- **User Service**: 6 tests passing (get all users, get by id, validation)
- **Health Service**: 2 tests passing (welcome, health check)

## API Behavior

### POST /matches

- Returns **201 Created** on success
- Returns **400 Bad Request** for invalid data (missing fields, negative scores)
- Returns **404 Not Found** if winner or loser doesn't exist

### GET /matches/:username

- Returns **200 OK** with array of matches (may be empty)
- Returns **404 Not Found** if username doesn't exist
- Matches ordered by `played_at DESC` (newest first)

## Next Steps (Optional)

1. Add OAuth route tests with mocking
2. Add integration tests for OAuth flow
3. Consider adding protected route middleware tests
4. Add Google OAuth provider support
