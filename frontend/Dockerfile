# ============================================
# Stage 1: Build frontend assets
# ============================================
FROM node:18.20.5-alpine AS builder

WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build tools)
RUN npm ci && \
    npm cache clean --force

# Copy source files
COPY . .

# Build static assets (TypeScript, Tailwind CSS, etc.)
RUN npm run build

# ============================================
# Stage 2: Production nginx server
# ============================================
FROM nginx:alpine

# Install gettext for envsubst (runtime config injection) and curl for health check
RUN apk add --no-cache gettext curl && \
    rm -rf /var/cache/apk/*

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy and make entrypoint executable
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Health check (curl works better with nginx than wget due to IPv6 handling)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4200/ || exit 1

EXPOSE 4200

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]