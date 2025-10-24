# Environment Management Guide

## Overview

This project uses environment variables passed through Docker Compose. All services read their configuration from `process.env` at runtime.

## Files Structure

```
ft_transcendence/
├── .env                    # Local overrides (gitignored)
├── .env.example            # Template with all variables and defaults
├── docker-compose.yml      # Service definitions with environment variables
└── <service>/
    ├── Dockerfile          # Contains default ENV values
    └── src/config.ts       # Reads from process.env
```

## How It Works

**Priority Order (Highest to Lowest):**

1. **`.env` file** - Your local overrides (gitignored)
2. **`docker-compose.yml`** - References variables from `.env` with fallback defaults
3. **Dockerfile `ENV`** - Hard defaults for when nothing else is set

## Setup Instructions

### Quick Start

The project works out-of-the-box with defaults. Just run:

```bash
make all
# or
docker compose up -d
```

### Customize Settings (Optional)

If you need to change ports, URLs, or other settings:

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit .env with your values
nano .env

# 3. Restart services
docker compose up -d
```

## Available Configuration Variables

See `.env.example` for the complete list. Key variables:

| Variable           | Default                | Description                               |
| ------------------ | ---------------------- | ----------------------------------------- |
| `NODE_ENV`         | `production`           | Environment mode                          |
| `LOG_LEVEL`        | `info`                 | Logging verbosity (error/warn/info/debug) |
| `SESSION_SECRET`   | (example value)        | **CHANGE THIS** for evaluation            |
| `LIVECHAT_PORT`    | `3002`                 | Live chat service port                    |
| `AUTH_SERVICE_URL` | `http://databank:3000` | Internal service URL                      |

## Important Notes

### Session Secret

The `SESSION_SECRET` in `.env.example` is a placeholder. For evaluation, either:

- Create a `.env` file with your own secret
- Or leave it as-is (works but not recommended for security demonstration)

### Service Communication

Services communicate using Docker network names:

```bash
✅ AUTH_SERVICE_URL=http://databank:3000    # Use service name
❌ AUTH_SERVICE_URL=http://localhost:3000   # Won't work in containers
```
