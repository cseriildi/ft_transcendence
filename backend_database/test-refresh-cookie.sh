#!/bin/bash

# Script to test refresh token cookie behavior
# This simulates what a frontend application would experience

BASE_URL="http://localhost:3000"
AUTH_PREFIX="/auth"

echo "=========================================="
echo "Refresh Token Cookie Testing Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Temporary file to store cookies
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

echo "Step 1: Register a new user"
echo "----------------------------"
REGISTER_RESPONSE=$(curl -s -c $COOKIE_JAR -X POST \
  "$BASE_URL$AUTH_PREFIX/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testcookie",
    "email": "testcookie@example.com",
    "password": "securepass123",
    "confirmPassword": "securepass123"
  }')

echo "Response:"
echo "$REGISTER_RESPONSE" | jq '.'

# Check if refresh_token cookie was set
if grep -q "refresh_token" $COOKIE_JAR; then
    print_success "Refresh token cookie was set on registration"
    echo "Cookie details:"
    grep "refresh_token" $COOKIE_JAR
else
    print_error "Refresh token cookie was NOT set on registration"
fi
echo ""

# Extract access token from response
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.tokens.accessToken')
print_info "Access token: $ACCESS_TOKEN"
echo ""

echo "Step 2: Test refresh endpoint WITH cookie"
echo "------------------------------------------"
REFRESH_RESPONSE=$(curl -s -b $COOKIE_JAR -c $COOKIE_JAR -X POST \
  "$BASE_URL$AUTH_PREFIX/refresh" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$REFRESH_RESPONSE" | jq '.'

if echo "$REFRESH_RESPONSE" | jq -e '.success' | grep -q "true"; then
    print_success "Refresh endpoint succeeded with cookie"
    # Check if new refresh_token cookie was set
    if grep -q "refresh_token" $COOKIE_JAR; then
        print_success "New refresh token cookie was set"
    else
        print_error "New refresh token cookie was NOT set"
    fi
else
    print_error "Refresh endpoint failed"
    echo "Error: $(echo "$REFRESH_RESPONSE" | jq -r '.message')"
fi
echo ""

echo "Step 3: Test refresh endpoint WITHOUT cookie"
echo "---------------------------------------------"
# Clear cookie jar
rm -f $COOKIE_JAR
touch $COOKIE_JAR

REFRESH_NO_COOKIE=$(curl -s -X POST \
  "$BASE_URL$AUTH_PREFIX/refresh" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$REFRESH_NO_COOKIE" | jq '.'

if echo "$REFRESH_NO_COOKIE" | jq -e '.success' | grep -q "false"; then
    if echo "$REFRESH_NO_COOKIE" | jq -r '.message' | grep -q "No refresh token"; then
        print_success "Correctly rejected request without refresh token cookie"
    else
        print_error "Rejected but with unexpected error message"
    fi
else
    print_error "Should have rejected request without cookie"
fi
echo ""

echo "Step 4: Login again to get new cookie"
echo "--------------------------------------"
rm -f $COOKIE_JAR
COOKIE_JAR=$(mktemp)

LOGIN_RESPONSE=$(curl -s -c $COOKIE_JAR -X POST \
  "$BASE_URL$AUTH_PREFIX/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcookie@example.com",
    "password": "securepass123"
  }')

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.'

if grep -q "refresh_token" $COOKIE_JAR; then
    print_success "Refresh token cookie was set on login"
    echo "Cookie details:"
    grep "refresh_token" $COOKIE_JAR
else
    print_error "Refresh token cookie was NOT set on login"
fi
echo ""

echo "Step 5: Logout and test cookie is cleared"
echo "------------------------------------------"
LOGOUT_RESPONSE=$(curl -s -b $COOKIE_JAR -c $COOKIE_JAR -X POST \
  "$BASE_URL$AUTH_PREFIX/logout" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$LOGOUT_RESPONSE" | jq '.'

if echo "$LOGOUT_RESPONSE" | jq -e '.success' | grep -q "true"; then
    print_success "Logout succeeded"
    
    # Try to refresh with the now-revoked token
    echo ""
    echo "Step 6: Try to refresh with revoked token"
    echo "------------------------------------------"
    REFRESH_AFTER_LOGOUT=$(curl -s -b $COOKIE_JAR -X POST \
      "$BASE_URL$AUTH_PREFIX/refresh" \
      -H "Content-Type: application/json")
    
    echo "Response:"
    echo "$REFRESH_AFTER_LOGOUT" | jq '.'
    
    if echo "$REFRESH_AFTER_LOGOUT" | jq -e '.success' | grep -q "false"; then
        print_success "Correctly rejected refresh with revoked token"
    else
        print_error "Should have rejected refresh with revoked token"
    fi
else
    print_error "Logout failed"
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "All cookie tests completed. Check results above."
echo ""

# Cleanup
rm -f $COOKIE_JAR
