# ============================================
# Stage 1: Builder - Compile TypeScript
# ============================================
FROM node:18.20.5-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 2: Production - Minimal runtime image
# ============================================
FROM node:18.20.5-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info \
    HEALTHCHECK_HOST=127.0.0.1

# Expose port
EXPOSE 3001

# Health check - verify service is responding (uses $HEALTHCHECK_HOST and $PORT from ENV)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD /bin/sh -c 'node -e "require(\"http\").get(\"http://${HEALTHCHECK_HOST}:${PORT}/health\", (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"' || exit 1

# Start the application using compiled JavaScript
CMD ["node", "dist/server.js"]