#!/bin/sh
# Production entrypoint: Inject runtime configuration into static files

set -e

# Default values if not provided
PUBLIC_API_URL="${PUBLIC_API_URL:-https://localhost:8443/api}"
PUBLIC_WS_URL="${PUBLIC_WS_URL:-wss://localhost:8443/ws}"

echo "🔧 Frontend runtime configuration:"
echo "   API_URL: ${PUBLIC_API_URL}"
echo "   WS_URL: ${PUBLIC_WS_URL}"

# Inject runtime variables into built index.html
if [ -f /usr/share/nginx/html/index.html ]; then
  echo "💉 Injecting configuration..."
  sed -i "s|{{PUBLIC_API_URL}}|${PUBLIC_API_URL}|g" /usr/share/nginx/html/index.html
  sed -i "s|{{PUBLIC_WS_URL}}|${PUBLIC_WS_URL}|g" /usr/share/nginx/html/index.html
  echo "✅ Configuration injected successfully"
fi

# Execute the CMD (nginx)
exec "$@"