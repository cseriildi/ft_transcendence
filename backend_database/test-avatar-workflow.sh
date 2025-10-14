#!/bin/bash

# Test avatar upload workflow
API_URL="http://localhost:3000"

echo "🧪 Testing Avatar Upload Workflow"
echo "=================================="
echo ""

# Step 1: Register user
echo "Step 1: Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"test_user_$(date +%s)\",
    \"email\": \"test_$(date +%s)@example.com\",
    \"password\": \"TestPass123!\",
    \"confirmPassword\": \"TestPass123!\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.tokens.accessToken')
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.id')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Registration failed!"
  exit 1
fi

echo "✅ User registered (ID: $USER_ID)"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Create test image
echo "Step 2: Creating test avatar..."
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > test-avatar.png
echo "✅ Test image created"
echo ""

# Step 3: Upload avatar
echo "Step 3: Uploading avatar..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/users/avatar" \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@test-avatar.png")

echo "$UPLOAD_RESPONSE" | jq '.'

AVATAR_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.avatar_url')

if [ "$AVATAR_URL" != "null" ]; then
  echo "✅ Avatar uploaded successfully!"
  echo "Avatar URL: $AVATAR_URL"
  echo "Full URL: $API_URL$AVATAR_URL"
else
  echo "❌ Avatar upload failed!"
fi

# Cleanup
rm -f test-avatar.png

echo ""
echo "=================================="
echo "Test completed!"
