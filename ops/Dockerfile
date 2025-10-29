# ============================================
# Gateway nginx - Reverse Proxy & SSL Termination
# ============================================
FROM nginx:alpine

# Install dependencies
RUN apk add --no-cache \
    gettext \
    curl \
    && rm -rf /var/cache/apk/*

# Copy nginx config template (not in /etc/nginx/templates/ to avoid auto-processing)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy custom entrypoint script
COPY nginx-entrypoint.sh /docker-entrypoint.d/40-custom-template.sh
RUN chmod +x /docker-entrypoint.d/40-custom-template.sh

# Health check (verify nginx can respond)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${NGINX_HTTP_PORT:-8080}/ || exit 1

EXPOSE 80 443 8080 8443
