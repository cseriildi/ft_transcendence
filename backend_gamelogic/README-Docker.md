# Game Backend Docker Setup

This directory contains a Dockerized version of your game backend with Fastify and WebSocket support.

## Files Added

- `Dockerfile` - Docker configuration for building the container
- `docker-compose.yml` - Docker Compose configuration for easy deployment
- `.dockerignore` - Excludes unnecessary files from Docker build
- `tsconfig.json` - TypeScript configuration for compilation

## How to Build and Run

### Option 1: Using Docker Compose (Recommended)

```bash
# Build and run the container
docker-compose up --build

# Run in detached mode (background)
docker-compose up --build -d

# Stop the container
docker-compose down
```

### Option 2: Using Docker directly

```bash
# Build the image
docker build -t game-backend .

# Run the container
docker run -p 3000:3000 game-backend

# Run in detached mode
docker run -d -p 3000:3000 game-backend
```

## Access Your Application

Once running, your game backend will be available at:
- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/game`

## What the Container Does

1. **Base Image**: Uses Node.js 18 Alpine (lightweight)
2. **Dependencies**: Installs all required npm packages from `package.json`
3. **TypeScript Compilation**: Compiles your TypeScript code to JavaScript
4. **Static Files**: Serves files from the `public` directory
5. **WebSocket Support**: Provides real-time communication for your game
6. **Port**: Exposes port 3000 for external access

## Container Features

- **Lightweight**: Uses Alpine Linux for minimal size
- **Production Ready**: Configured for production deployment
- **Auto-restart**: With docker-compose, restarts automatically on failure
- **Hot Reload**: Rebuild with `--build` flag to include code changes

## Troubleshooting

If you make changes to your code, rebuild the container:
```bash
docker-compose up --build
```

To view logs:
```bash
docker-compose logs -f
```

To stop all containers:
```bash
docker-compose down --remove-orphans
```
