#!/bin/sh
# Script to inject environment variables into frontend at runtime

# Default values if not provided
PUBLIC_API_URL="${PUBLIC_API_URL:-https://localhost:8443/api}"
PUBLIC_WS_URL="${PUBLIC_WS_URL:-wss://localhost:8443/ws}"

# Log what we're injecting
echo "🔧 Frontend configuration ready:"
echo "   API_URL: ${PUBLIC_API_URL}"
echo "   WS_URL: ${PUBLIC_WS_URL}"

# Run the build first (via npm's prestart hook)
if [ "$1" = "npm" ] && [ "$2" = "start" ]; then
    echo "🏗️  Building frontend..."
    npm run build
    
    # Now inject the variables into the built files
    echo "💉 Injecting configuration into built files..."
    sed -i "s|{{PUBLIC_API_URL}}|${PUBLIC_API_URL}|g" /usr/src/app/dist/index.html
    sed -i "s|{{PUBLIC_WS_URL}}|${PUBLIC_WS_URL}|g" /usr/src/app/dist/index.html
    
    echo "✅ Frontend configuration injected successfully"
    
    # Start browser-sync without running prestart again
    exec npx browser-sync start --server 'dist' --files 'dist/**/*' --no-ui --port 4200 --reload-delay 10 --single
else
    # For other commands, just run them
    exec "$@"
fi
