# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Install SQLite3
RUN apk add --no-cache sqlite

# Set working directory
WORKDIR /app

# Create database directory
RUN mkdir -p /app/database

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# # Create dist directory
# RUN mkdir -p dist

# # Build TypeScript (compile to JS)
# RUN npx tsc

# Set default environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/database.db
ENV LOG_LEVEL=info

# Create data directory for database
RUN mkdir -p /app/data

# Expose port (use environment variable)
EXPOSE $PORT

# Start the application
# CMD ["npm", "run", "start"]
CMD ["npx", "tsx", "src/main.ts"]
