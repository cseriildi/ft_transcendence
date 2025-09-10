# Backend Database API

A simple REST API for user management with SQLite database, running on port 3001.

## Features

- User CRUD operations (Create, Read, Update, Delete)
- Password hashing with bcrypt
- Email and username validation
- SQLite database storage
- CORS and security headers enabled

## Quick Start

1. **Install dependencies** (when npm is available):
   ```bash
   npm install
   ```

2. **Initialize the database**:
   ```bash
   npm run db:init
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Or build and start production**:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Health Check
- **GET** `/health`
  - Returns server status and timestamp

### User Management

#### Get All Users
- **GET** `/users`
  - Returns all users (without passwords)

#### Get User by ID
- **GET** `/users/:id`
  - Returns specific user by ID

#### Create New User
- **POST** `/users`
  - Body: `{ "username": "string", "email": "string", "password": "string" }`
  - Validation: username (3-50 chars), valid email, password (min 6 chars)

#### Update User
- **PUT** `/users/:id`
  - Body: `{ "username"?: "string", "email"?: "string", "password"?: "string" }`
  - All fields optional

#### Delete User
- **DELETE** `/users/:id`
  - Removes user by ID

#### Login/Verify Password
- **POST** `/login`
  - Body: `{ "email": "string", "password": "string" }`
  - Returns user info if credentials are valid

## Example Usage

### Create a new user:
```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"username": "johndoe", "email": "john@example.com", "password": "secret123"}'
```

### Get all users:
```bash
curl http://localhost:3001/users
```

### Login:
```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "secret123"}'
```

### Update user:
```bash
curl -X PUT http://localhost:3001/users/1 \
  -H "Content-Type: application/json" \
  -d '{"username": "johnsmith"}'
```

### Delete user:
```bash
curl -X DELETE http://localhost:3001/users/1
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Error Handling

All endpoints return JSON responses with the following format:
- Success: `{ "success": true, "user": {...} }` or `{ "success": true, "users": [...] }`
- Error: `{ "success": false, "error": "Error message" }`

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (invalid login)
- 404: Not Found
- 500: Internal Server Error

## Security Features

- Passwords are hashed using bcrypt (salt rounds: 10)
- CORS enabled for cross-origin requests
- Security headers via Helmet middleware
- Input validation using Zod schemas
- SQL injection prevention with parameterized queries

## Files Structure

```
src/
├── main.ts          # Main server file with API routes
├── database.ts      # Database class with user operations
└── scripts/
    └── initDB.ts    # Database initialization script
```
