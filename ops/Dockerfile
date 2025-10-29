FROM nginx:alpine

# Install envsubst (part of gettext package)
RUN apk add --no-cache gettext curl

# Copy template to a different location (not /etc/nginx/templates/ to avoid auto-processing)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy custom entrypoint
COPY nginx-entrypoint.sh /docker-entrypoint.d/40-custom-template.sh
RUN chmod +x /docker-entrypoint.d/40-custom-template.sh
