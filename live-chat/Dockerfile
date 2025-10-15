# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Install SQLite3 and other build dependencies
RUN apk add --no-cache sqlite python3 make g++

# Set working directory
WORKDIR /app

# Create database directory
RUN mkdir -p /app/database

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript (compile to JS)
RUN npx tsc

# Remove devDependencies to reduce image size
RUN npm prune --production

# Set default environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/database.db
ENV LOG_LEVEL=info

# Create data directory for database
RUN mkdir -p /app/data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (use environment variable)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application using compiled JavaScript
CMD ["node", "dist/main.js"]