# ============================================
# Stage 1: Builder - Compile TypeScript
# ============================================
FROM node:18.20.5-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY tsup.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Copy database
COPY database ./database

# No build step - using tsx to run TypeScript directly

# ============================================
# Stage 2: Production - Runtime with tsx
# ============================================
FROM node:18.20.5-alpine AS production

# Install SQLite3 runtime and su-exec for user switching
RUN apk add --no-cache sqlite su-exec

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including tsx for runtime)
RUN npm ci && \
    npm cache clean --force

# Copy source code directly (no compilation)
COPY --from=builder /app/src ./src

# Copy database migrations
COPY --from=builder /app/src/db_migrator/migrations ./src/db_migrator/migrations

# Copy database initialization files
COPY --from=builder /app/database ./database

# Create data directory and set permissions
RUN mkdir -p /app/data && \
    mkdir -p /app/uploads/avatars/default && \
    chown -R nodejs:nodejs /app

# Copy default avatars
COPY uploads/avatars/default ./uploads/avatars/default

# Copy entrypoint script from scripts folder
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/database.db \
    LOG_LEVEL=info \
    HEALTHCHECK_HOST=127.0.0.1

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://${HEALTHCHECK_HOST}:${PORT}/health || exit 1

# Use custom entrypoint for permission handling
ENTRYPOINT ["docker-entrypoint.sh"]

# Start the application using tsx to run TypeScript directly
CMD ["npx", "tsx", "src/main.ts"]
