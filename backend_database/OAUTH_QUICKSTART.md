# OAuth Quick Start

## Prerequisites

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your OAuth credentials
   ```

## GitHub OAuth Setup (5 minutes)

1. **Create GitHub OAuth App**:

   - Go to https://github.com/settings/developers
   - Click "New OAuth App"
   - Fill in:
     - Application name: `Your App Name (Dev)`
     - Homepage URL: `http://localhost:3000`
     - Callback URL: `http://localhost:3000/oauth/github/callback`
   - Click "Register application"

2. **Get Credentials**:

   - Copy the **Client ID**
   - Click "Generate a new client secret" and copy it

3. **Add to .env**:

   ```bash
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   GITHUB_REDIRECT_URI=http://localhost:3000/oauth/github/callback
   ```

4. **Start server**:

   ```bash
   npm run dev
   ```

5. **Test OAuth**:
   ```bash
   ./test-oauth.sh github
   ```
   Or manually visit: http://localhost:3000/oauth/github

## What You Get

### Authentication Methods

1. **Email/Password Auth**:

   - `POST /register` - Create account
   - `POST /login` - Login
   - `POST /logout` - Logout
   - `POST /refresh` - Rotate tokens

2. **OAuth (GitHub)**:
   - `GET /oauth/github` - Start OAuth flow
   - `GET /oauth/github/callback` - Handle callback
   - Uses same logout/refresh endpoints

### Response Format

All endpoints return:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2025-10-01T12:34:56.789Z",
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "message": "Login successful",
  "timestamp": "2025-10-01T12:34:56.789Z"
}
```

### Token Management

- **Access Token**: Short-lived (15min), sent in response body, use in `Authorization: Bearer <token>` header
- **Refresh Token**: Long-lived (7 days), stored in HttpOnly cookie, automatically sent by browser

### Account Linking

OAuth automatically links accounts by email:

- User registers with email `user@example.com` and password
- Later, user logs in via GitHub with same email
- Account is automatically linked
- User can now login with either method

## Testing

Run all tests:

```bash
npm test
```

Test coverage includes:

- ✅ Registration (password)
- ✅ Login/logout (password)
- ✅ Token refresh and rotation
- ✅ Token revocation
- ✅ Duplicate email handling
- ✅ Invalid credentials

## Full Documentation

See [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md) for:

- Google OAuth setup
- Production deployment
- Troubleshooting
- Security best practices
- API reference

## Quick Test Commands

```bash
# Test health
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"pass123","confirmPassword":"pass123"}'

# Login
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}' \
  -c cookies.txt

# Refresh token
curl -X POST http://localhost:3000/refresh \
  -b cookies.txt \
  -c cookies.txt

# Logout
curl -X POST http://localhost:3000/logout \
  -b cookies.txt

# GitHub OAuth (automated)
./test-oauth.sh github
```

## Architecture

```
src/
├── services/
│   ├── authService/          # Password auth (register, login, logout, refresh)
│   │   ├── authController.ts
│   │   ├── authRoutes.ts
│   │   └── authTypes.ts
│   └── oAuthService/         # OAuth providers (GitHub, Google)
│       ├── oAuthController.ts
│       ├── oAuthRoutes.ts
│       └── oAuthTypes.ts
├── utils/
│   ├── authutils.ts         # JWT signing/verification
│   ├── oauthUtils.ts        # OAuth helpers (state, token exchange)
│   ├── errorUtils.ts        # Error handling
│   └── responseUtils.ts     # API response formatting
└── database.ts              # SQLite schema with OAuth support
```

## Security Features

- ✅ JWT access tokens (short-lived)
- ✅ Refresh token rotation
- ✅ HttpOnly secure cookies
- ✅ CSRF protection via state parameter
- ✅ Password hashing (bcrypt)
- ✅ Token revocation on logout
- ✅ Email verification from OAuth providers
- ✅ Automatic account linking by email
