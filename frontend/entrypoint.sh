#!/bin/sh
# Script to inject environment variables into frontend at runtime

# Default values if not provided
PUBLIC_API_URL="${PUBLIC_API_URL:-https://localhost:8443/api}"
PUBLIC_WS_URL="${PUBLIC_WS_URL:-wss://localhost:8443/ws}"

# Log what we're injecting
echo "🔧 Injecting frontend configuration:"
echo "   API_URL: ${PUBLIC_API_URL}"
echo "   WS_URL: ${PUBLIC_WS_URL}"

# Replace placeholders in index.html
sed -i "s|{{PUBLIC_API_URL}}|${PUBLIC_API_URL}|g" /usr/src/app/dist/index.html
sed -i "s|{{PUBLIC_WS_URL}}|${PUBLIC_WS_URL}|g" /usr/src/app/dist/index.html

echo "✅ Frontend configuration injected successfully"

# Start the application
exec "$@"
