# Logging Guide

This project uses **Fastify's built-in Pino logger** for structured, high-performance logging.

## Overview

- **Production**: JSON-formatted logs to stdout (for log aggregators like Loki, ELK, CloudWatch)
- **Development**: Pretty-printed colored logs with timestamps
- **Log Levels**: trace, debug, info, warn, error, fatal
- **Default Level**: Configured via `LOG_LEVEL` environment variable (default: "info")

## Basic Usage

### In Controllers (via createHandler)

```typescript
export const userController = {
  getUser: createHandler<{ Params: { id: string } }>(
    async (request, { db }) => {
      // Access logger via request
      request.log.info({ userId: request.params.id }, "Fetching user");
      
      const user = await db.get(/*...*/);
      
      if (!user) {
        request.log.warn({ userId: request.params.id }, "User not found");
        throw errors.notFound("User");
      }
      
      request.log.info({ userId: user.id, username: user.username }, "User fetched successfully");
      return ApiResponseHelper.success(user);
    }
  ),
};
```

### Log Levels

```typescript
// DEBUG - Detailed debug information
request.log.debug({ query: "SELECT * FROM users" }, "Executing query");

// INFO - Important events (logins, registrations, etc.)
request.log.info({ userId: 123 }, "User logged in");

// WARN - Warning conditions (deprecated usage, recoverable errors)
request.log.warn({ attemptedEmail: "test@test.com" }, "Failed login attempt");

// ERROR - Error conditions (exceptions, failed operations)
request.log.error({ error: err.message, userId: 123 }, "Failed to update user");

// FATAL - System is unusable
request.log.fatal({ error: err.message }, "Database connection lost");
```

## Structured Logging Best Practices

### ✅ DO: Use structured data

```typescript
// Good - structured with context
request.log.info({
  userId: user.id,
  username: user.username,
  action: "profile_update"
}, "User updated profile");
```

### ❌ DON'T: Use string interpolation

```typescript
// Bad - not structured
request.log.info(`User ${user.id} (${user.username}) updated profile`);
```

### ✅ DO: Add relevant context

```typescript
// Good - includes all relevant context
request.log.error({
  userId: request.user!.id,
  friendId: request.params.id,
  error: err.message,
  stack: err.stack
}, "Failed to add friend");
```

### ❌ DON'T: Log sensitive data

```typescript
// Bad - never log passwords, tokens, etc.
request.log.info({ password: user.password }, "User registered"); // ❌
request.log.info({ accessToken: token }, "Token generated"); // ❌
```

## Current Logging Points

### Authentication
- User registration (`authController.createUser`)
- User login (`authController.loginUser`)
- User logout (`authController.logout`)

### Database
- Connection success/failure (`database.ts`)
- Schema initialization (`database.ts`)

### Errors
- All uncaught errors logged by `errorHandlerPlugin.ts`

### Application Lifecycle
- Server startup (`main.ts`)
- Server shutdown (automatic via Fastify)

## Optional: Request/Response Logging

Detailed request/response logging is available but **disabled by default** for performance.

To enable (in `main.ts`):

```typescript
// Uncomment these lines:
const { requestLogger, responseLogger } = await import("./middleware/loggingMiddleware.ts");
app.addHook("onRequest", requestLogger);
app.addHook("onResponse", responseLogger);
```

This logs:
- Every incoming request (method, URL, IP, user)
- Every response (status code, user)
- Automatic log level based on status (5xx = error, 4xx = warn, 2xx/3xx = info)

## Log Aggregation Setup

### Local Development
Logs are automatically pretty-printed to the console.

### Production (Docker + Log Aggregator)

Your container logs to stdout/stderr in JSON format. Common setups:

1. **Loki (Grafana)**
   ```yaml
   # docker-compose.yml
   services:
     backend:
       logging:
         driver: loki
         options:
           loki-url: "http://loki:3100/loki/api/v1/push"
   ```

2. **ELK Stack**
   ```yaml
   services:
     backend:
       logging:
         driver: "fluentd"
         options:
           fluentd-address: "localhost:24224"
   ```

3. **CloudWatch (AWS)**
   ```yaml
   services:
     backend:
       logging:
         driver: awslogs
         options:
           awslogs-group: /ecs/backend
           awslogs-region: us-east-1
   ```

## Environment Variables

```bash
# Set log level
LOG_LEVEL=debug   # trace, debug, info, warn, error, fatal
```

## Troubleshooting

### Logs not appearing?
- Check `LOG_LEVEL` environment variable
- Ensure you're using `request.log` not `console.log`

### Too verbose in development?
- Set `LOG_LEVEL=warn` to reduce noise

### Need to see all database queries?
- Set `LOG_LEVEL=trace` (very verbose!)

### Production logs not structured?
- Verify `NODE_ENV=production` is set
- Check that pino-pretty is not in production dependencies
