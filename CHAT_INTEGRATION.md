# Live Chat Integration Guide

## Overview

The live-chat service has been integrated into the ft_transcendence infrastructure. This document explains how to use it.

## Architecture

The live-chat service provides real-time chat functionality through a unified WebSocket endpoint:

- **Service**: live-chat (internal port 3002)
- **WebSocket**: `wss://localhost:8443/ws/chat`
- **HTTP Endpoints**: `https://localhost:8443/chat/` (health, ready, lobby/block)
- **Database**: SQLite at `./live-chat/src/database/database.db`

## Access URLs

All access goes through the Nginx gateway:

- **WebSocket Connection**: `wss://localhost:8443/ws/chat?userId={id}&username={name}`
- **Health Check**: `https://localhost:8443/chat/health`
- **Ready Check**: `https://localhost:8443/chat/ready`
- **Block User**: `POST https://localhost:8443/chat/lobby/block`

## Quick Start

### 1. Build and Start Services

```bash
# Generate SSL certificates (if not already done)
chmod +x ./scripts/certs.sh && ./scripts/certs.sh

# Build and start all services including live-chat
docker compose up -d --build
```

### 2. Verify Live Chat is Running

```bash
# Check logs
docker compose logs -f live-chat

# Test health endpoint
curl -k https://localhost:8443/chat/health
# Should return: {"status":"ok"}

# Test ready endpoint (includes database check)
curl -k https://localhost:8443/chat/ready
# Should return: {"status":"ready","database":"connected"}
```

## Frontend Integration

### Connect to Chat

```javascript
// Connect to unified WebSocket endpoint
const userId = 123; // Get from authenticated user
const username = "alice"; // Get from authenticated user

const ws = new WebSocket(
  `wss://localhost:8443/ws/chat?userId=${userId}&username=${encodeURIComponent(
    username,
  )}`,
);

ws.onopen = () => {
  console.log("Connected to chat");

  // Join the lobby
  ws.send(
    JSON.stringify({
      action: "join_lobby",
    }),
  );
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleChatMessage(data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("Chat disconnected");
};
```

### Chat Actions

#### Join Lobby

```javascript
ws.send(
  JSON.stringify({
    action: "join_lobby",
  }),
);
// Response: { type: "lobby_connected", message: "...", allUsers: [...] }
```

#### Start/Join Chat

```javascript
// chatid format: sorted usernames joined by dash
const chatid = ["alice", "bob"].sort().join("-"); // "alice-bob"

ws.send(
  JSON.stringify({
    action: "join_chat",
    chatid: chatid,
  }),
);
// Response: { type: "chat_connected", message: "...", history: [...] }
```

#### Send Message

```javascript
ws.send(
  JSON.stringify({
    action: "send_message",
    chatid: "alice-bob",
    message: "Hello!",
  }),
);
// Other users receive: { type: "message", chatid: "alice-bob", username: "alice", message: "Hello!", timestamp: ... }
```

#### Leave Chat

```javascript
ws.send(
  JSON.stringify({
    action: "leave_chat",
    chatid: "alice-bob",
  }),
);
// Response: { type: "chat_left", message: "..." }
```

#### Leave Lobby

```javascript
ws.send(
  JSON.stringify({
    action: "leave_lobby",
  }),
);
// Response: { type: "lobby_left", message: "..." }
```

### Block User

Blocking is done via HTTP POST (requires active lobby connection):

```javascript
await fetch("https://localhost:8443/chat/lobby/block", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    blocker: "alice",
    blocked: "bob",
  }),
});
```

## Message Types

### From Client to Server (Actions)

- `join_lobby` - Join the lobby to see online users
- `leave_lobby` - Leave the lobby
- `join_chat` - Join a specific chat room
- `leave_chat` - Leave a specific chat room
- `send_message` - Send a message in a chat room

### From Server to Client (Types)

- `lobby_connected` - Successfully joined lobby, includes user list
- `lobby_left` - Successfully left lobby
- `user_list_update` - User joined/left lobby (broadcast)
- `chat_connected` - Successfully joined chat, includes history
- `chat_left` - Successfully left chat
- `message` - New message in chat room
- `system` - System notification (user online/offline)
- `error` - Error occurred

## Important Notes

### Message Filtering

Since one WebSocket handles multiple chats, **always filter messages by `chatid`**:

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "message" && data.chatid !== currentChatId) {
    return; // Ignore messages from other chats
  }

  handleMessage(data);
};
```

### Connection Management

- One WebSocket per user (reuse for lobby + all chats)
- Always join lobby before starting chats
- Clean up: leave all chats and lobby before closing connection

### Chat History

- Last 20 messages per room
- Sent automatically when joining a chat
- Includes username, message, and timestamp

## Testing

### Using the Test Client

The live-chat service includes a test client:

```bash
# Open the test client in your browser
open live-chat/src/www/unified-ws-client.html
```

Or serve it via Python:

```bash
cd live-chat/src/www
python3 -m http.server 8080
# Then open http://localhost:8080/unified-ws-client.html
```

### Running Tests

```bash
cd live-chat
npm test
```

## Troubleshooting

### Check Service Status

```bash
# View live-chat logs
docker compose logs -f live-chat

# Check if container is running
docker compose ps live-chat

# Restart live-chat service
docker compose restart live-chat
```

### Common Issues

**WebSocket connection fails:**

- Verify nginx is running: `docker compose ps nginx`
- Check nginx configuration: `docker compose exec nginx cat /etc/nginx/nginx.conf | grep chat`
- Ensure SSL certificates exist: `ls -la .certs/`

**Database errors:**

- Check database directory exists: `ls -la live-chat/src/database/`
- Verify database permissions: `docker compose exec live-chat ls -la /app/data/`

**Can't block users:**

- Ensure you're connected to lobby first (WebSocket must be active)
- Blocker must have an active lobby connection
- Check request format matches: `{ blocker: "username", blocked: "username" }`

## Documentation

For more details, see:

- `live-chat/ReadMe.md` - Complete API documentation
- `live-chat/ARCHITECTURE.md` - System architecture diagrams
- `live-chat/TESTING_GUIDE.md` - Testing instructions
- `live-chat/WEBSOCKET_AUTHENTICATION.md` - Authentication setup

## Development

### Local Development (without Docker)

```bash
cd live-chat

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run in development mode
npm run dev

# Run tests
npm test
```

The service will be available at `http://localhost:3002/ws`

### Environment Variables

See `live-chat/.env.example` for all configuration options:

- `PORT` - Server port (default: 3002)
- `HOST` - Server host (default: ::)
- `DATABASE_PATH` - SQLite database path
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (info/error/debug)
