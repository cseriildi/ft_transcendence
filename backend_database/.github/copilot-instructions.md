# Copilot Instructions - Fastify TypeScript Backend

This is a Fastify-based TypeScript backend with SQLite database, following a clean MVC architecture pattern.

## Architecture Overview

- **Entry Point**: `src/main.ts` registers plugins in order: database → error handler → routes
- **Plugin Pattern**: Uses Fastify plugins (`fp()`) for database connector and error handler
- **Database**: SQLite with promisified callback pattern, decorated on Fastify instance as `request.server.db`
- **Type Safety**: Comprehensive TypeScript types for all requests/responses in `src/types/`

## Key Patterns

### Database Access
```typescript
// Always use promisified SQLite callbacks in controllers
const user = await new Promise<User | null>((resolve, reject) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if (err) reject(errors.internal("Database error"));
    else resolve(row || null);
  });
});
```

### Error Handling
- Use `errors` factory from `utils/errors.ts`: `errors.notFound("User")`, `errors.validation("message")`
- Global error handler in `plugins/errorHandler.ts` catches `AppError` instances
- Controllers throw errors; error handler formats responses consistently

### Response Format
- All responses use `ApiResponseHelper` from `utils/responses.ts`
- Success: `ApiResponseHelper.success(data, "message")`
- Structure: `{ success: boolean, data?: T, message?: string, timestamp: string }`

### Route Structure
- Routes in `routes/` register handler functions from `controllers/`
- Type generics on route definitions: `fastify.get<{ Params: UserParams; Reply: GetUserResponse }>(...)`
- Controllers return typed responses, don't call `reply.send()`

## Development Workflow

### Local Development (Dev Container)
```bash
# Start dev server with hot reload
npm run dev

# Override environment variables
NODE_ENV=development PORT=3001 npm run dev

# Test endpoints
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"username": "john_doe", "email": "john@example.com"}'
curl http://localhost:3000/users/1
```

### Database Schema
- SQLite auto-initialized in `database.ts` with users table
- Schema includes: `id`, `username` (unique), `email` (unique), `created_at`
- Database path configurable via `DATABASE_PATH` env var

### Configuration
- Environment-based config in `config.ts` with validation on startup
- Key env vars: `PORT`, `HOST`, `NODE_ENV`, `DATABASE_PATH`, `LOG_LEVEL`
- Config validation logs startup info and validates port

## File Organization

- `src/controllers/` - Business logic and database operations
- `src/routes/` - Route definitions and type annotations  
- `src/types/` - TypeScript interfaces for requests/responses
- `src/utils/` - Shared utilities (errors, responses)
- `src/plugins/` - Fastify plugins (error handler, etc.)

When adding new features, follow the established pattern: create types first, then controller logic, then register routes with proper type generics.