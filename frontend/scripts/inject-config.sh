#!/bin/bash
# Frontend local dev environment injector
# Replaces template placeholders in index.html with environment variables

set -e

# Load environment variables from .env.development
if [ -f ".env.development" ]; then
  echo "📦 Loading environment from .env.development"
  set -a
  source .env.development
  set +a
fi

# Default values if not provided
PUBLIC_API_URL="${PUBLIC_API_URL:-http://localhost:3000}"
PUBLIC_WS_URL="${PUBLIC_WS_URL:-ws://localhost:3002/ws}"

echo "🔧 Frontend development configuration:"
echo "   API_URL: ${PUBLIC_API_URL}"
echo "   WS_URL: ${PUBLIC_WS_URL}"

# Copy source to dist and inject variables
echo "💉 Injecting configuration into dist/index.html..."
mkdir -p dist
cp src/index.html dist/index.html

# Use cross-platform sed (compatible with both Linux and macOS)
if sed --version >/dev/null 2>&1; then
  # GNU sed (Linux)
  sed -i "s|{{PUBLIC_API_URL}}|${PUBLIC_API_URL}|g" dist/index.html
  sed -i "s|{{PUBLIC_WS_URL}}|${PUBLIC_WS_URL}|g" dist/index.html
else
  # BSD sed (macOS)
  sed -i '' "s|{{PUBLIC_API_URL}}|${PUBLIC_API_URL}|g" dist/index.html
  sed -i '' "s|{{PUBLIC_WS_URL}}|${PUBLIC_WS_URL}|g" dist/index.html
fi

echo "✅ Configuration injected successfully"
