# Refresh Token Cookie Testing & Debugging Guide

## Summary of Findings

After thorough testing, the refresh token cookie system is **working correctly** in the backend:

### ✅ What's Working

1. **Cookie is being set correctly** on:
   - User registration (`POST /auth/register`)
   - User login (`POST /auth/login`)
   - Token refresh (`POST /auth/refresh`)

2. **Cookie properties are correct**:
   - `httpOnly: true` - Prevents JavaScript access (security)
   - `path: '/auth'` - Cookie only sent to /auth endpoints
   - `sameSite: 'Lax'` - CSRF protection
   - `maxAge: 604800000` (7 days in milliseconds)
   - `secure: false` in development, `true` in production

3. **Database storage is correct**:
   - Refresh token is hashed with bcrypt before storing
   - Token hash matches the cookie value
   - JTI (JWT ID) is used to uniquely identify tokens
   - Tokens are properly revoked on logout

4. **Token rotation works**:
   - On refresh, old token is deleted
   - New token is generated and stored
   - New cookie is set with the new token

## Why Frontend Might Get "No refresh token provided"

If your frontend is getting "No refresh token provided", here are the likely causes:

### 1. **Cookie Path Mismatch** ⚠️ MOST LIKELY CAUSE

The cookie is set with `path: '/auth'`, which means:
- ✅ Cookie IS sent to: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`
- ❌ Cookie NOT sent to: `/api/users`, `/`, any non-/auth path

**Solution**: Ensure your frontend is making requests to the correct paths:
```javascript
// ✅ CORRECT - Cookie will be sent
fetch('http://localhost:3000/auth/refresh', { 
  credentials: 'include' 
})

// ❌ WRONG - Cookie will NOT be sent (path doesn't start with /auth)
fetch('http://localhost:3000/refresh', { 
  credentials: 'include' 
})
```

### 2. **Missing `credentials: 'include'`**

Cookies are NOT sent by default in fetch/axios with CORS. You must explicitly include credentials:

```javascript
// ✅ CORRECT
fetch('http://localhost:3000/auth/refresh', {
  method: 'POST',
  credentials: 'include',  // THIS IS REQUIRED!
  headers: {
    'Content-Type': 'application/json'
  }
})

// ❌ WRONG - No credentials option
fetch('http://localhost:3000/auth/refresh', {
  method: 'POST'
})
```

For Axios:
```javascript
// ✅ CORRECT
axios.post('http://localhost:3000/auth/refresh', {}, {
  withCredentials: true  // THIS IS REQUIRED!
})
```

### 3. **CORS Configuration**

If frontend and backend are on different origins, you need proper CORS configuration:

**Backend needs** (in Fastify):
```typescript
app.register(cors, {
  origin: 'http://localhost:5173',  // Your frontend URL
  credentials: true  // REQUIRED to allow cookies
})
```

**Frontend needs**:
```javascript
fetch('http://localhost:3000/auth/refresh', {
  credentials: 'include'  // REQUIRED to send cookies
})
```

### 4. **Secure Flag in Production**

If you're testing in production with HTTPS, make sure:
- Backend sets `secure: true` (automatically done when `NODE_ENV=production`)
- Frontend uses HTTPS or the cookie won't be sent

### 5. **Domain/SameSite Issues**

If frontend and backend are on different domains:
- `sameSite: 'Lax'` might block the cookie
- Consider using `sameSite: 'None'` with `secure: true` for cross-domain
- Or set up a proxy so frontend and backend appear to be on the same domain

## How to Test

### Option 1: Run the Automated Tests

```bash
# Test that cookies are set and match database
npm test -- refresh-token-debug.test.ts

# All tests should pass, showing:
# ✓ Cookie is set on registration
# ✓ Cookie matches database hash
# ✓ Cookie is set on login
# ✓ Refresh endpoint works with cookie
# ✓ Refresh endpoint fails without cookie
# ✓ Logout revokes token
```

### Option 2: Manual Testing with the Script

1. **Start your backend server**:
   ```bash
   npm run dev
   ```

2. **Run the cookie test script** (in another terminal):
   ```bash
   ./test-refresh-cookie.sh
   ```

   This will:
   - Register a user and check if cookie is set
   - Test refresh endpoint WITH cookie (should succeed)
   - Test refresh endpoint WITHOUT cookie (should fail)
   - Test login sets cookie
   - Test logout clears/revokes cookie

### Option 3: Manual Testing with curl

```bash
# 1. Register (cookie will be saved to cookies.txt)
curl -v -c cookies.txt -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'

# Look for "Set-Cookie: refresh_token=..." in the response headers

# 2. Use the cookie to refresh (cookie will be sent from cookies.txt)
curl -v -b cookies.txt -c cookies.txt -X POST http://localhost:3000/auth/refresh

# Look for success response and new "Set-Cookie: refresh_token=..." header

# 3. Try refresh WITHOUT cookie (should fail)
curl -v -X POST http://localhost:3000/auth/refresh

# Should get: {"success":false,"message":"No refresh token provided"}
```

## Database Verification

To verify tokens are stored correctly:

```bash
# Connect to your database
sqlite3 ./src/database/database.db

# View refresh tokens
SELECT jti, user_id, substr(token_hash, 1, 20) as hash_preview, 
       revoked, created_at, expires_at 
FROM refresh_tokens;

# After logout, check token is revoked
SELECT jti, revoked FROM refresh_tokens WHERE revoked = 1;
```

## Frontend Implementation Checklist

When implementing refresh token logic in your frontend:

- [ ] Use `credentials: 'include'` on ALL requests to /auth endpoints
- [ ] Ensure requests are made to `/auth/refresh` (not `/refresh`)
- [ ] Set up CORS properly if frontend/backend on different origins
- [ ] Backend has `credentials: true` in CORS config
- [ ] Don't try to access the cookie from JavaScript (it's httpOnly)
- [ ] Handle 401 errors from refresh endpoint (means token invalid/expired)
- [ ] On 401 from refresh, redirect user to login

## Example Frontend Code

```typescript
// Refresh access token
async function refreshAccessToken() {
  try {
    const response = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      credentials: 'include',  // CRITICAL!
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Refresh token invalid or expired
      // Redirect to login
      window.location.href = '/login';
      return null;
    }
    
    const data = await response.json();
    return data.data.tokens.accessToken;
  } catch (error) {
    console.error('Refresh failed:', error);
    window.location.href = '/login';
    return null;
  }
}

// Logout
async function logout() {
  await fetch('http://localhost:3000/auth/logout', {
    method: 'POST',
    credentials: 'include',  // CRITICAL!
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  // Redirect to login
  window.location.href = '/login';
}
```

## Configuration to Check

### Backend `.env` or environment:
```bash
NODE_ENV=development  # or production
JWT_REFRESH_SECRET=your-secret-here
JWT_ACCESS_SECRET=your-secret-here
```

### Frontend Vite config (if using Vite):
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',  // Proxy to avoid CORS
      '/api': 'http://localhost:3000'
    }
  }
})
```

## Test Results

All automated tests pass ✅:
- Cookies are set with correct properties
- Cookie values match database hashes
- Token rotation works correctly
- Logout properly revokes tokens
- Refresh endpoint correctly validates tokens

The backend implementation is solid. The issue is likely in:
1. Frontend not sending `credentials: 'include'`
2. CORS not configured to allow credentials
3. Request path not starting with `/auth`

## Debugging Steps

1. **Check browser DevTools**:
   - Network tab → Look at request to `/auth/login` or `/auth/register`
   - Response headers → Should see `Set-Cookie: refresh_token=...`
   - Application/Storage tab → Cookies → Should see `refresh_token` cookie

2. **Check request to `/auth/refresh`**:
   - Network tab → Look at request
   - Request headers → Should see `Cookie: refresh_token=...`
   - If cookie header is missing, frontend isn't sending credentials

3. **Check console for CORS errors**:
   - Look for: "Access to fetch has been blocked by CORS policy"
   - If present, backend CORS config needs `credentials: true`

4. **Verify paths**:
   - Cookie path is `/auth`
   - Request must be to `/auth/refresh` (not just `/refresh`)
