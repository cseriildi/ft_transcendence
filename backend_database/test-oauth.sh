#!/bin/bash

# OAuth Manual Testing Script
# This script helps you test the OAuth flow locally

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
PROVIDER="${1:-github}"

echo "🔐 OAuth Testing Script"
echo "======================"
echo ""
echo "Provider: $PROVIDER"
echo "Base URL: $BASE_URL"
echo ""

if [ "$PROVIDER" != "github" ] && [ "$PROVIDER" != "google" ]; then
  echo "❌ Invalid provider. Use: github or google"
  echo "Usage: ./test-oauth.sh [github|google]"
  exit 1
fi

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s -f "$BASE_URL/health" > /dev/null; then
  echo "❌ Server is not running at $BASE_URL"
  echo "   Start the server with: npm run dev"
  exit 1
fi
echo "✅ Server is running"
echo ""

# Step 1: Get OAuth redirect URL
echo "📋 Step 1: Getting OAuth redirect URL..."
RESPONSE=$(curl -s -X GET "$BASE_URL/oauth/$PROVIDER")
REDIRECT_URL=$(echo "$RESPONSE" | grep -o '"redirectUrl":"[^"]*"' | cut -d'"' -f4)

if [ -z "$REDIRECT_URL" ]; then
  echo "❌ Failed to get redirect URL"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ Redirect URL obtained"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👉 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open this URL in your browser:"
echo ""
echo "   $REDIRECT_URL"
echo ""
echo "2. Authorize the application"
echo ""
echo "3. After authorization, you'll be redirected to:"
echo "   $BASE_URL/oauth/$PROVIDER/callback?code=...&state=..."
echo ""
echo "4. Check your browser's Network tab to see:"
echo "   - Access token in response body"
echo "   - refresh_token cookie (HttpOnly)"
echo ""
echo "5. Copy the access token and test with:"
echo ""
echo "   # Test protected endpoint (if you have one)"
echo "   curl -X GET $BASE_URL/auth/me \\"
echo "     -H \"Authorization: Bearer <your-access-token>\""
echo ""
echo "   # Test refresh"
echo "   curl -X POST $BASE_URL/refresh \\"
echo "     -H \"Cookie: refresh_token=<your-refresh-token>\""
echo ""
echo "   # Test logout"
echo "   curl -X POST $BASE_URL/logout \\"
echo "     -H \"Cookie: refresh_token=<your-refresh-token>\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Option to open in browser automatically (if xdg-open or open is available)
if command -v xdg-open > /dev/null 2>&1; then
  read -p "🌐 Open in browser now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    xdg-open "$REDIRECT_URL"
  fi
elif command -v open > /dev/null 2>&1; then
  read -p "🌐 Open in browser now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "$REDIRECT_URL"
  fi
fi

echo "✅ Done!"
