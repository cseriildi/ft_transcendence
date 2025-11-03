# Fastify TypeScript Backend

A production-ready REST API built with Fastify, TypeScript, and SQLite, featuring JWT authentication, OAuth integration, 2FA support, and comprehensive testing.

## Features

- 🔐 **Authentication** - JWT access/refresh tokens with secure rotation
- 🔑 **OAuth** - GitHub and Google OAuth integration
- 📱 **2FA** - Two-factor authentication with TOTP
- 👥 **User Management** - Profile management with avatar uploads
- 🤝 **Friend System** - Friend requests and online status tracking
- 🏓 **Match Tracking** - Record and retrieve match statistics
- 📊 **API Documentation** - Auto-generated Swagger/OpenAPI docs
- ✅ **Comprehensive Testing** - 141 passing tests with Vitest
- 🔍 **Code Quality** - ESLint + Prettier with pre-commit hooks
- 📝 **Structured Logging** - Pino logger with JSON output

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

### Development

```bash
# Start dev server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Production

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t fastify-backend .

# Run container
docker run -p 3000:3000 fastify-backend
```

## API Documentation

When running in development mode, Swagger documentation is available at:

```
http://localhost:3000/docs
```

## Project Structure

```
src/
├── main.ts              # Application entry point
├── config.ts            # Configuration management
├── database.ts          # Database plugin
├── middleware/          # Auth & logging middleware
├── plugins/             # Error handler
├── routes/              # Route definitions
├── services/            # Feature modules (auth, users, matches, etc.)
├── types/               # TypeScript type definitions
└── utils/               # Shared utilities

tests/                   # Test files
docs/                    # Documentation
scripts/                 # Build & deployment scripts
```

## Documentation

- **[Logging Guide](docs/LOGGING.md)** - Structured logging with Pino
- **[Testing Guide](docs/TESTING.md)** - Running and writing tests
- **[OAuth Setup](docs/oauth/)** - OAuth provider configuration

## Environment Variables

Key environment variables (see `.env.example` for full list):

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./src/database/database.db

# JWT Secrets
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-secret-here

# OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Logging
LOG_LEVEL=info
```

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Fastify 5.x
- **Language:** TypeScript 5.x
- **Database:** SQLite3
- **Authentication:** JWT (jose), bcrypt
- **Testing:** Vitest
- **Linting:** ESLint + Prettier
- **Documentation:** Swagger/OpenAPI

## License

ISC

## Contributing

Contributions welcome! Please ensure all tests pass and code is properly formatted before submitting PRs.
