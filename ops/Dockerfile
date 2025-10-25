FROM nginx:alpine

# Install envsubst (part of gettext package)
RUN apk add --no-cache gettext

# Copy template
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Copy custom entrypoint
COPY nginx-entrypoint.sh /docker-entrypoint.d/40-custom-template.sh
RUN chmod +x /docker-entrypoint.d/40-custom-template.sh
