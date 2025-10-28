# ============================================
# Stage 1: Builder - Compile TypeScript
# ============================================
FROM node:18.20.5-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

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

# Install SQLite3 runtime (only what's needed)
RUN apk add --no-cache sqlite-libs

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

# Copy database initialization files
COPY --from=builder /app/src/database ./src/database

# Create data directory and set permissions
RUN mkdir -p /app/data && \
    mkdir -p /app/uploads/avatars/default && \
    chown -R nodejs:nodejs /app

# Copy default avatars
COPY uploads/avatars/default ./uploads/avatars/default

# Switch to non-root user
USER nodejs

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/database.db \
    LOG_LEVEL=info

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application using compiled JavaScript
CMD ["node", "dist/main.js"]
