#!/bin/sh
# Gateway nginx entrypoint: Generate config and wait for backend services
set -e

# Set defaults
export NGINX_HTTPS_PORT=${NGINX_HTTPS_PORT:-8443}
export NGINX_HTTP_PORT=${NGINX_HTTP_PORT:-8080}
export NGINX_HOST=${NGINX_HOST:-localhost}
export FRONTEND_PORT=${FRONTEND_PORT:-4200}
export DATABANK_PORT=${DATABANK_PORT:-3000}
export GAMELOGIC_PORT=${GAMELOGIC_PORT:-3001}
export LIVECHAT_PORT=${LIVECHAT_PORT:-3002}

echo "🔧 Gateway nginx configuration:"
echo "   HTTPS: ${NGINX_HTTPS_PORT}, HTTP: ${NGINX_HTTP_PORT}"
echo "   Frontend: frontend:${FRONTEND_PORT}"
echo "   Databank: databank:${DATABANK_PORT}"
echo "   GameLogic: backend:${GAMELOGIC_PORT}"
echo "   LiveChat: live-chat:${LIVECHAT_PORT}"

# Generate nginx config from template
envsubst '${NGINX_HTTPS_PORT} ${NGINX_HTTP_PORT} ${NGINX_HOST} ${FRONTEND_PORT} ${DATABANK_PORT} ${GAMELOGIC_PORT} ${LIVECHAT_PORT}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "✅ Generated nginx configuration"

# Wait for dependent services (best-effort, non-blocking)
wait_for_service() {
  name="$1"
  host="$2"
  port="$3"
  timeout="${4:-30}"
  
  echo "⏳ Waiting for $name at $host:$port (timeout ${timeout}s)..."
  
  for i in $(seq 1 "$timeout"); do
    if curl -sf --max-time 1 "http://$host:$port/health" >/dev/null 2>&1; then
      echo "✅ $name is ready"
      return 0
    fi
    sleep 1
  done
  
  echo "⚠️  Timeout waiting for $name (continuing anyway)"
  return 1
}

# Wait for critical services (best-effort)
wait_for_service "databank" "databank" "$DATABANK_PORT" 15 || true
wait_for_service "gamelogic" "backend" "$GAMELOGIC_PORT" 15 || true
wait_for_service "live-chat" "live-chat" "$LIVECHAT_PORT" 10 || true

echo "🚀 Starting nginx gateway..."
exec nginx -g 'daemon off;'
