# ============================================
# Stage 1: Builder - Compile TypeScript
# ============================================
FROM node:18.20.5-alpine AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (needed for TypeScript compilation)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Compile TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 2: Production - Final minimal image
# ============================================
FROM node:18.20.5-alpine AS production

# Install runtime dependencies (sqlite for database, su-exec for user switching)
RUN apk add --no-cache sqlite su-exec

WORKDIR /app

# Create non-root user and group
RUN addgroup -g 1001 nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

# Copy static files (WebSocket HTML client)
COPY src/www ./src/www

# Create necessary directories and set ownership
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

# Copy and setup entrypoint script
COPY entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production \
    PORT=3002 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/database.db \
    LOG_LEVEL=info \
    HEALTHCHECK_HOST=127.0.0.1

# Expose port
EXPOSE 3002

# Health check using shell form to allow variable expansion
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/bin/sh", "-c", "wget --no-verbose --tries=1 --spider http://${HEALTHCHECK_HOST}:${PORT}/health || exit 1"]

# Use entrypoint to fix volume permissions, then switch to non-root user
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the application
CMD ["node", "dist/main.js"]