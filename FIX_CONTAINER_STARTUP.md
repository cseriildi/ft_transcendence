# Container Startup Fix

## Issue
Database and live-chat containers crash-looping after introducing strict environment variable validation in production mode.

**Symptom:** CI pipeline returns 502 instead of expected 401

## Root Causes
1. Missing environment variables: `PUBLIC_HOST`, `PUBLIC_PORT`, `PUBLIC_PROTOCOL`, `CORS_ORIGINS`
2. Entrypoint scripts failing on `chown` permission errors with mounted volumes
3. nodejs user unable to write to host-owned mounted directories

## Solution
1. **Added to `.env`:**
   ```
   PUBLIC_HOST=localhost
   PUBLIC_PORT=8443
   PUBLIC_PROTOCOL=https
   CORS_ORIGINS=https://localhost:8443,http://localhost:8080,http://localhost:4200
   ```

2. **Updated entrypoint scripts** (`backend_database/scripts/docker-entrypoint.sh` & `live-chat/entrypoint.sh`):
   - Suppress chown errors with `2>/dev/null || true`
   - Run as root when chown fails (needed for mounted volume write access)
   - Run as nodejs user when chown succeeds (better security)

## Result
✅ Containers start successfully  
✅ API returns correct status codes (401 for protected, 200 for public)  
✅ CI pipeline should pass
