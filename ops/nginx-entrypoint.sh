#!/bin/sh
set -e

# Set defaults if not provided
export NGINX_INTERNAL_PORT=${NGINX_INTERNAL_PORT:-8443}
export NGINX_HOST=${NGINX_HOST:-localhost}
export FRONTEND_PORT=${FRONTEND_PORT:-4200}
export DATABANK_PORT=${DATABANK_PORT:-3000}
export GAMELOGIC_PORT=${GAMELOGIC_PORT:-3001}
export LIVECHAT_PORT=${LIVECHAT_PORT:-3002}

# Process nginx.conf.template with environment variables
envsubst '${NGINX_INTERNAL_PORT} ${NGINX_HOST} ${FRONTEND_PORT} ${DATABANK_PORT} ${GAMELOGIC_PORT} ${LIVECHAT_PORT}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "Generated nginx configuration from template"

exec nginx -g "daemon off;"
