#!/bin/sh
# Runtime entrypoint for production frontend (nginx-based)

# Default values if not provided
PUBLIC_API_URL="${PUBLIC_API_URL:-https://localhost:8443/api}"
PUBLIC_WS_URL="${PUBLIC_WS_URL:-wss://localhost:8443/ws}"

echo "🔧 Frontend configuration ready:"
echo "   API_URL: ${PUBLIC_API_URL}"
echo "   WS_URL: ${PUBLIC_WS_URL}"

# Inject runtime variables into built index.html (and any other files that use placeholders)
if [ -f /usr/share/nginx/html/index.html ]; then
    echo "💉 Injecting configuration into built files..."
    sed -i "s|{{PUBLIC_API_URL}}|${PUBLIC_API_URL}|g" /usr/share/nginx/html/index.html || true
    sed -i "s|{{PUBLIC_WS_URL}}|${PUBLIC_WS_URL}|g" /usr/share/nginx/html/index.html || true
    echo "✅ Frontend configuration injected successfully"
fi

# Start nginx (default CMD) — exec any provided command
if [ "$#" -eq 0 ]; then
    exec nginx -g "daemon off;"
else
    exec "$@"
fi
