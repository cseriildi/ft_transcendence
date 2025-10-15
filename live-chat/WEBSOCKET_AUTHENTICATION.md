# WebSocket Authentication Guide

## The Challenge

WebSocket authentication presents a unique challenge because of how different clients handle headers:

### Node.js (Backend/Testing)
✅ **Supports custom headers** via the `ws` library:
```javascript
const ws = new WebSocket('ws://localhost:3000', {
  headers: {
    'Authorization': 'Bearer token123'
  }
});
```

### Browser (Frontend)
❌ **Does NOT support custom headers**. The browser WebSocket API only accepts:
```javascript
new WebSocket(url, protocols)  // No way to add headers!
```

## Authentication Solutions

### 1. Authorization Header (Node.js Only)
**Best for:** Server-to-server communication, testing
**Security:** ✅ Excellent - token not in URL
**Browser Support:** ❌ No

```javascript
// Server (Fastify)
fastify.get("/ws", { websocket: true }, async (connection, req) => {
  const access = req.headers.authorization;
  if (!access || !access.startsWith("Bearer ")) {
    connection.close();
    return;
  }
  const token = access.substring(7);
  // Validate token...
});

// Client (Node.js)
const ws = new WebSocket('ws://localhost:3000/ws', {
  headers: { Authorization: 'Bearer token123' }
});
```

### 2. Query Parameters
**Best for:** Quick prototyping, public tokens
**Security:** ⚠️ Fair - token visible in URL and logs
**Browser Support:** ✅ Yes

```javascript
// Server
const { token } = req.query;
if (!token) {
  connection.close();
  return;
}

// Client (Browser & Node.js)
const ws = new WebSocket('ws://localhost:3000/ws?token=abc123');
```

**Drawbacks:**
- Token appears in URL
- May be logged by proxies/servers
- Visible in browser history

### 3. Cookies (RECOMMENDED for Browsers)
**Best for:** Browser-based applications
**Security:** ✅ Excellent - httpOnly cookies protected from XSS
**Browser Support:** ✅ Yes

```javascript
// Server
await app.register(cors, {
  origin: 'http://localhost:4200',
  credentials: true  // Important!
});

fastify.get("/ws", { websocket: true }, async (connection, req) => {
  const token = req.cookies.authToken;
  if (!token) {
    connection.close();
    return;
  }
  // Validate token...
});

// Client (Browser)
const ws = new WebSocket('ws://localhost:3000/ws');
// Cookie automatically sent with WebSocket upgrade request
```

**Setup:**
```javascript
// Login endpoint sets cookie
reply.setCookie('authToken', token, {
  httpOnly: true,
  secure: true,  // HTTPS only
  sameSite: 'strict',
  path: '/',
  maxAge: 3600
});
```

### 4. First Message Authentication
**Best for:** Flexibility, custom protocols
**Security:** ✅ Good - token encrypted in WSS
**Browser Support:** ✅ Yes

```javascript
// Server
fastify.get("/ws", { websocket: true }, async (connection, req) => {
  let authenticated = false;
  
  connection.once("message", async (message) => {
    try {
      const { token } = JSON.parse(message.toString());
      // Validate token...
      authenticated = true;
      connection.send(JSON.stringify({ type: "auth_success" }));
    } catch {
      connection.close();
    }
  });
  
  // Set timeout for auth
  setTimeout(() => {
    if (!authenticated) connection.close();
  }, 5000);
});

// Client (Browser)
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({ token: 'abc123' }));
};
```

## Current Implementation

### Production Code (`src/main.ts`)
Authentication is **currently disabled** (commented out):
```typescript
// Authentication disabled for testing
// In production, validate token from query params or cookies
// const access = req.headers.authorization as string;
// if (!access || !access.startsWith("Bearer ")) {
//   connection.close();
//   return;
// }
```

The commented code checks for **Authorization headers**, which works for:
- Server-to-server communication
- Node.js clients
- Testing environments

**For browser clients, you should enable cookie-based authentication:**
1. Use `@fastify/cookie` plugin
2. Set `credentials: true` in CORS
3. Check `req.cookies.authToken` instead of `req.headers.authorization`

### Test Implementation (`src/websocket-lobby.test.ts`)
The tests use **Authorization headers** because:
- Tests run in Node.js environment
- The `ws` library supports custom headers
- Matches the commented production code pattern
- Best practice for server-side WebSocket clients

**6 authentication test cases:**
1. ✅ Missing Authorization header → rejected
2. ✅ Empty Bearer token → rejected
3. ✅ Invalid token → rejected
4. ✅ Token for different user → rejected
5. ✅ Valid token → accepted
6. ✅ Multiple users with different tokens → accepted

## Recommendations

### For Production Browser App
```javascript
// 1. Use cookies
await app.register(require('@fastify/cookie'));

// 2. Update WebSocket handler
fastify.get("/ws", { websocket: true }, async (connection, req) => {
  const token = req.cookies.authToken;  // From cookie
  if (!token) {
    connection.close();
    return;
  }
  
  // Validate token
  try {
    const response = await fetch(`http://auth-server/validate`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      connection.close();
      return;
    }
  } catch (err) {
    connection.close();
    return;
  }
  
  // Continue with WebSocket setup...
});

// 3. Browser client (cookies sent automatically)
const ws = new WebSocket('ws://localhost:3000/ws');
```

### For Server-to-Server Communication
Keep the Authorization header approach (already in commented code).

### For Testing
Continue using Authorization headers with the `ws` library (current implementation).

## Security Checklist

- [ ] Use WSS (WebSocket Secure) in production
- [ ] Validate token on every connection
- [ ] Set reasonable token expiration
- [ ] Implement rate limiting
- [ ] Use httpOnly cookies for browsers
- [ ] Enable CORS with specific origins
- [ ] Log authentication failures
- [ ] Implement reconnection with token refresh
- [ ] Handle token expiration gracefully
- [ ] Use CSP headers to prevent XSS

## References

- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [ws library documentation](https://github.com/websockets/ws)
- [Fastify WebSocket plugin](https://github.com/fastify/fastify-websocket)
