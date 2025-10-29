FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
# Install devDeps in builder so tsc/tailwindcss are available for build
RUN npm ci

COPY . .

# Build static files
RUN npm run build

FROM nginx:alpine

# Create app user (optional) and expose port 4200
EXPOSE 4200

# Copy built assets from builder
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx config to listen on 4200
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint (inject runtime config) and make executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]