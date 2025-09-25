# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create dist directory
RUN mkdir -p dist

# Build TypeScript (compile to JS)
RUN npx tsc

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]