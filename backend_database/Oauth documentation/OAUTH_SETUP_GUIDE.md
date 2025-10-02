# OAuth Setup Guide

This guide walks you through setting up OAuth authentication with GitHub (and optionally Google) for local development and production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [GitHub OAuth Setup](#github-oauth-setup)
- [Google OAuth Setup](#google-oauth-setup-optional)
- [Environment Configuration](#environment-configuration)
- [Testing OAuth Locally](#testing-oauth-locally)
- [Production Deployment](#production-deployment)

---

## Prerequisites

1. Node.js and npm installed
2. A GitHub account (for GitHub OAuth)
3. A Google account (for Google OAuth, optional)
4. Your app running locally (default: `http://localhost:3000`)

---

## GitHub OAuth Setup

### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:
   - **Application name**: `Ping Pong API (Development)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/oauth/github/callback`
   - **Application description**: (optional) "Local development OAuth"
4. Click **"Register application"**

### Step 2: Get Your Credentials

1. After registration, you'll see your **Client ID**
2. Click **"Generate a new client secret"**
3. Copy both the **Client ID** and **Client Secret** immediately (you won't be able to see the secret again)

### Step 3: Add to Environment Variables

Add these to your `.env` file:

```bash
GITHUB_CLIENT_ID=your_actual_client_id_here
GITHUB_CLIENT_SECRET=your_actual_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3000/oauth/github/callback
```

---

## Google OAuth Setup (Optional)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to **APIs & Services > Library**
   - Search for "Google+ API"
   - Click **Enable**

### Step 2: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **"Create Credentials" > "OAuth client ID"**
3. If prompted, configure the OAuth consent screen:
   - **User Type**: External (for testing) or Internal (for organization)
   - **App name**: `Ping Pong API`
   - **User support email**: Your email
   - **Developer contact**: Your email
   - **Scopes**: Add `email` and `profile`
   - **Test users**: Add your email (if using External)
   - Save and continue
4. Back to "Create OAuth client ID":
   - **Application type**: Web application
   - **Name**: `Ping Pong API (Development)`
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3000/oauth/google/callback`
5. Click **Create**

### Step 3: Get Your Credentials

1. Copy the **Client ID** and **Client Secret**
2. Add to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/google/callback
```

---

## Environment Configuration

### 1. Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Update your `.env` file with actual values:

```bash
# Server Configuration
PORT=3000
HOST=::

# Database Configuration  
DATABASE_PATH=./src/database/database.db

# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info

# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
JWT_ISSUER=ping-pong-api
JWT_AUDIENCE=ping-pong-clients

# OAuth Configuration
OAUTH_STATE_SECRET=your-oauth-state-secret-change-this-in-production

# GitHub OAuth
GITHUB_CLIENT_ID=<paste-your-github-client-id>
GITHUB_CLIENT_SECRET=<paste-your-github-client-secret>
GITHUB_REDIRECT_URI=http://localhost:3000/oauth/github/callback

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<paste-your-google-client-id>
GOOGLE_CLIENT_SECRET=<paste-your-google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/google/callback
```

### 3. Generate Strong Secrets

For production, generate cryptographically secure secrets:

```bash
# Generate random secrets (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 32
```

Replace these in your `.env`:
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `OAUTH_STATE_SECRET`

---

## Testing OAuth Locally

### 1. Start Your Server

```bash
npm run dev
```

### 2. Test GitHub OAuth Flow

#### Option A: Using Browser

1. Open your browser to: `http://localhost:3000/oauth/github`
2. Server responds with:
   ```json
   {
     "success": true,
     "data": {
       "redirectUrl": "https://github.com/login/oauth/authorize?client_id=..."
     },
     "message": "GitHub OAuth redirect created"
   }
   ```
3. Copy the `redirectUrl` and paste it in your browser
4. Authorize the app on GitHub
5. GitHub redirects back to `http://localhost:3000/oauth/github/callback?code=...&state=...`
6. Server responds with:
   ```json
   {
     "success": true,
     "data": {
       "id": 1,
       "username": "Your Name",
       "email": "your@email.com",
       "created_at": "2025-10-01T12:34:56.789Z",
       "tokens": {
         "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
       }
     },
     "message": "GitHub OAuth login successful"
   }
   ```
7. Check your cookies - you should see `refresh_token` (HttpOnly)

#### Option B: Using curl

```bash
# Step 1: Get redirect URL
curl -X GET http://localhost:3000/oauth/github

# Step 2: Open the redirectUrl in a browser, authorize, and get the callback URL
# It will look like: http://localhost:3000/oauth/github/callback?code=abc123&state=xyz789

# Step 3: The callback is handled automatically by the browser
# You can inspect the response in browser DevTools > Network tab
```

#### Option C: Frontend Integration Example

```javascript
// Initiate OAuth
async function loginWithGitHub() {
  const res = await fetch('http://localhost:3000/oauth/github');
  const { data } = await res.json();
  
  // Redirect user to GitHub
  window.location.href = data.redirectUrl;
}

// After GitHub redirects back to your app:
// The callback endpoint will set the refresh_token cookie
// and return the access token in the response body.
// Store the access token in memory (not localStorage!)
```

### 3. Verify Token Received

```bash
# Use the access token from the response
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <your-access-token>"
```

### 4. Test Refresh Token

```bash
# Refresh tokens are in HttpOnly cookies, so use -b to include cookies
curl -X POST http://localhost:3000/refresh \
  -b "refresh_token=<your-refresh-token>" \
  -c cookies.txt
```

### 5. Test Logout

```bash
curl -X POST http://localhost:3000/logout \
  -b "refresh_token=<your-refresh-token>"
```

---

## Testing Different Scenarios

### Scenario 1: New User (First-time OAuth)
- No existing account with that email
- Creates new user with `oauth_provider='github'` and `oauth_id='12345'`
- Issues JWT tokens

### Scenario 2: Existing User (Account Linking)
- User already exists with email `user@example.com` (password login)
- User logs in via GitHub OAuth with same email
- Updates user record: `oauth_provider='github'`, `oauth_id='12345'`
- Issues JWT tokens

### Scenario 3: Returning OAuth User
- User already has `oauth_provider='github'` and `oauth_id='12345'`
- Finds existing user by provider+id
- Issues JWT tokens

---

## Production Deployment

### 1. Update OAuth App Settings

#### GitHub:
1. Go back to your [GitHub OAuth Apps](https://github.com/settings/developers)
2. Create a **new** OAuth app for production or edit the existing one
3. Update URLs:
   - **Homepage URL**: `https://yourdomain.com`
   - **Authorization callback URL**: `https://yourdomain.com/oauth/github/callback`
4. Get new Client ID and Secret for production

#### Google:
1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth client or create a new one
3. Update:
   - **Authorized JavaScript origins**: `https://yourdomain.com`
   - **Authorized redirect URIs**: `https://yourdomain.com/oauth/google/callback`

### 2. Update Environment Variables

Set these on your production server (e.g., Heroku, Vercel, Railway, etc.):

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Strong secrets (never reuse dev secrets!)
JWT_ACCESS_SECRET=<production-secret-32-bytes>
JWT_REFRESH_SECRET=<production-secret-32-bytes>
OAUTH_STATE_SECRET=<production-secret-32-bytes>

# Production OAuth credentials
GITHUB_CLIENT_ID=<production-github-client-id>
GITHUB_CLIENT_SECRET=<production-github-client-secret>
GITHUB_REDIRECT_URI=https://yourdomain.com/oauth/github/callback

GOOGLE_CLIENT_ID=<production-google-client-id>
GOOGLE_CLIENT_SECRET=<production-google-client-secret>
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth/google/callback
```

### 3. Security Checklist

- ✅ Use HTTPS in production (required for secure cookies)
- ✅ Set `NODE_ENV=production` (enables secure cookies)
- ✅ Never commit `.env` to version control
- ✅ Use strong, unique secrets (32+ bytes)
- ✅ Rotate secrets periodically
- ✅ Set CORS to allow only your frontend domain
- ✅ Rate-limit OAuth endpoints
- ✅ Monitor OAuth callback failures

---

## Troubleshooting

### "Invalid state parameter"
- State mismatch or expired (>10 minutes)
- Solution: Clear cookies and try again

### "Email not available from GitHub"
- GitHub user has private email
- Solution: Request `user:email` scope (already configured)

### "OAuth provider not configured"
- Missing `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET`
- Solution: Check `.env` file and restart server

### "Invalid redirect_uri"
- Mismatch between env var and GitHub app settings
- Solution: Ensure URLs match exactly (including trailing slashes)

### "Authorization failed"
- User denied permission on GitHub
- Solution: User must authorize the app

### "Failed to exchange code for token"
- Invalid code or client secret
- Solution: Check credentials, codes expire quickly (use within 10 minutes)

---

## API Endpoints Reference

### OAuth Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/oauth/github` | Initiate GitHub OAuth | `{ redirectUrl }` |
| GET | `/oauth/github/callback` | GitHub callback handler | User + tokens |
| GET | `/oauth/google` | Initiate Google OAuth | `{ redirectUrl }` |
| GET | `/oauth/google/callback` | Google callback handler | User + tokens |

### Auth Endpoints

| Method | Endpoint | Description | Cookie Set |
|--------|----------|-------------|-----------|
| POST | `/register` | Create user with password | `refresh_token` |
| POST | `/login` | Login with email/password | `refresh_token` |
| POST | `/refresh` | Rotate tokens | `refresh_token` (new) |
| POST | `/logout` | Revoke refresh token | Cookie cleared |

---

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Verify environment variables are set correctly
3. Check server logs for detailed error messages
4. Ensure OAuth app callback URLs match exactly

For more information:
- [GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
