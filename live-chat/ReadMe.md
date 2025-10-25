# Live Chat WebSocket API

## Overview
This chat application uses a **single unified WebSocket endpoint** (`/ws`) with action-based routing for all operations. This design is more efficient than using multiple WebSocket connections.

## Architecture
- **Single WebSocket Connection**: `/ws` handles both lobby and chat operations
- **Action-Based Protocol**: All client messages include an `action` field
- **State Management**: Server tracks which rooms each connection is in
- **Authentication**: Supports Bearer token via Authorization header (Node.js) or cookies (browsers)

---

## Connection

### Establishing WebSocket Connection

#### Browser (Production)
```javascript
// Browser WebSocket API does NOT support custom headers
// Authentication should use cookies (recommended) or query parameters

const username = "alice";

// Connect to unified WebSocket endpoint
const ws = new WebSocket(`ws://host/ws?username=${encodeURIComponent(username)}`);

ws.onopen = () => {
  console.log("WebSocket connected");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleMessage(data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("WebSocket closed");
};
```

#### Node.js (Server-to-Server or Testing)
```javascript
// Node.js 'ws' library supports custom headers
const WebSocket = require('ws');

const username = "alice";
const token = "<your-token>";

const ws = new WebSocket(`ws://host/ws?username=${encodeURIComponent(username)}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

ws.on('open', () => {
  console.log("WebSocket connected");
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  handleMessage(message);
});
```

**Note**: Authentication is currently disabled for testing. See `WEBSOCKET_AUTHENTICATION.md` for production authentication setup.

---

## Lobby Operations

### Join Lobby
After establishing the WebSocket connection, send a join_lobby action:

```javascript
ws.send(JSON.stringify({
  action: "join_lobby",
  token: "access-token"
}));
```

**Response** (to joining user):
```javascript
{
  type: "lobby_connected",
  message: "Welcome alice! You are now online.",
  allUsers: ["bob", "charlie"]  // List of other online users
}
```

**Broadcast** (to other lobby users):
```javascript
{
  type: "user_list_update",
  allUsers: ["alice", "bob", "charlie"]  // Updated list excluding recipient
}
```

### Leave Lobby
```javascript
ws.send(JSON.stringify({
  action: "leave_lobby"
}));
```

**Response**:
```javascript
{
  type: "lobby_left",
  message: "Left lobby"
}
```

**Broadcast** (to other lobby users):
```javascript
{
  type: "user_list_update",
  allUsers: ["bob", "charlie"]  // Updated list without the leaving user
}
```

---

## Chat Operations

### Join Chat
To start a chat, send a join_chat action with a `chatid`:

**ChatId Format**: Sorted usernames separated by dash (e.g., `"alice-bob"`)

```javascript
ws.send(JSON.stringify({
  action: "join_chat",
  chatid: "alice-bob"
}));
```

**Response** (successful):
```javascript
{
  type: "chat_connected",
  message: "Connected to chat: alice-bob",
  history: [
    {
      username: "alice",
      message: "Hello!",
      timestamp: 1697384400000
    },
    {
      username: "bob",
      message: "Hi there!",
      timestamp: 1697384460000
    }
  ]  // Last 20 messages
}
```

**Response** (if blocked):
```javascript
{
  type: "error",
  message: "You are blocked by this user."
}
```

**Broadcast** (to other user in chat):
```javascript
{
  type: "system",
  message: "alice is online."
}
```

### Send Message
```javascript
ws.send(JSON.stringify({
  action: "send_message",
  chatid: "alice-bob",
  message: "Hello, how are you?"
}));
```

**Broadcast** (to other user in chat):
```javascript
{
  type: "message",
  chatid: "alice-bob",  // Important: filter messages by chatid on client
  username: "alice",
  message: "Hello, how are you?",
  timestamp: 1697384500000
}
```

**Note**: The sender does NOT receive their own message back. The client should display it immediately upon sending.

**Response** (if blocked):
```javascript
{
  type: "error",
  message: "You are blocked by this user and cannot send messages."
}
```

### Leave Chat
```javascript
ws.send(JSON.stringify({
  action: "leave_chat",
  chatid: "alice-bob"
}));
```

**Response**:
```javascript
{
  type: "chat_left",
  message: "Left chat: alice-bob"
}
```

**Broadcast** (to other user in chat):
```javascript
{
  type: "system",
  message: "alice has left."
}
```

### Rejoining a Chat
If a user rejoins a chat they're already in, they receive the history again:

```javascript
{
  type: "chat_connected",
  message: "Reconnected to chat: alice-bob",
  history: [...]
}
```

---

## Blocking

### Block User
Blocking is done via **HTTP POST** request, not WebSocket:

**Endpoint**: `POST /lobby/block`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```javascript
{
  blocker: "alice",
  blocked: "bob"
}
```

**Response** (success):
```javascript
{
  success: true
}
```

**Response** (error - not in lobby):
```javascript
{
  error: "Blocking user is not authorized"
}
```

**Note**: The blocker must be connected to the lobby (have an active WebSocket connection with `join_lobby`).

---

## Message Types Reference

### Client to Server (Actions)
| Action | Required Fields | Description |
|--------|----------------|-------------|
| `join_lobby` | - | Join the lobby |
| `leave_lobby` | - | Leave the lobby |
| `join_chat` | `chatid` | Join a chat room |
| `leave_chat` | `chatid` | Leave a chat room |
| `send_message` | `chatid`, `message` | Send a message in a chat |

### Server to Client (Types)
| Type | Fields | When Sent |
|------|--------|-----------|
| `lobby_connected` | `message`, `allUsers` | User successfully joins lobby |
| `lobby_left` | `message` | User successfully leaves lobby |
| `user_list_update` | `allUsers` | Another user joins/leaves lobby |
| `chat_connected` | `message`, `history` | User successfully joins chat |
| `chat_left` | `message` | User successfully leaves chat |
| `message` | `chatid`, `username`, `message`, `timestamp` | Message received in chat |
| `system` | `message` | System notification (user online/offline) |
| `error` | `message` | Error occurred |

---

## Important Implementation Notes

### Message Filtering
Since a single WebSocket connection can be in multiple chats, **clients MUST filter messages by `chatid`**:

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'message') {
    // Only show message if it's for the currently active chat
    if (data.chatid === currentChatId) {
      displayMessage(data.username, data.message, data.timestamp);
    }
  }
};
```

### Connection Management
- **One WebSocket per user**: Reuse the same connection for lobby and all chats
- **Explicit actions**: Always send `join_lobby` after connection, `join_chat` before messaging
- **Clean up**: Send `leave_chat` and `leave_lobby` before closing connection
- **Reconnection**: Establish new WebSocket and rejoin lobby/chats

### State Tracking
The server tracks:
- Whether connection is in lobby (`inLobby` boolean)
- Which chat rooms connection is in (`userChatRooms` Set)
- Ban list per user (loaded from database)
- Chat history (last 20 messages per room)

### Chat History
- Maximum 20 messages stored per chat room
- Sent when user joins chat
- Includes username, message, and timestamp

---

## Example: Complete Flow

```javascript
// 1. Establish connection
const ws = new WebSocket('ws://localhost:3002/ws?userId=1&username=alice');

ws.onopen = () => {
  console.log("Connected");
  
  // 2. Join lobby
  ws.send(JSON.stringify({ action: "join_lobby" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'lobby_connected':
      console.log("In lobby. Users:", data.allUsers);
      // User clicks on "bob" to start chat
      break;
      
    case 'user_list_update':
      updateUserList(data.allUsers);
      break;
      
    case 'chat_connected':
      console.log("Chat opened:", data.message);
      displayHistory(data.history);
      break;
      
    case 'message':
      if (data.chatid === currentChatId) {
        displayMessage(data.username, data.message, data.timestamp);
      }
      break;
      
    case 'system':
      displaySystemMessage(data.message);
      break;
      
    case 'error':
      showError(data.message);
      break;
  }
};

// 3. User clicks to chat with "bob"
function startChat(otherUser) {
  const chatid = [username, otherUser].sort().join('-');
  currentChatId = chatid;
  
  ws.send(JSON.stringify({
    action: "join_chat",
    chatid: chatid
  }));
}

// 4. Send message
function sendMessage(text) {
  ws.send(JSON.stringify({
    action: "send_message",
    chatid: currentChatId,
    message: text
  }));
  
  // Display immediately on sender side
  displayMessage(username, text, Date.now());
}

// 5. Leave chat
function leaveChat() {
  ws.send(JSON.stringify({
    action: "leave_chat",
    chatid: currentChatId
  }));
  currentChatId = null;
}

// 6. Block user
async function blockUser(blockedUsername) {
  const response = await fetch('http://localhost:3002/lobby/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocker: username,
      blocked: blockedUsername
    })
  });
  
  if (response.ok) {
    console.log("User blocked");
    leaveChat(); // Close current chat if blocking that user
  }
}

// 7. Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (currentChatId) {
    ws.send(JSON.stringify({ action: "leave_chat", chatid: currentChatId }));
  }
  ws.send(JSON.stringify({ action: "leave_lobby" }));
  ws.close();
});
```

---

## Testing

A test client is available at `/workspace/src/www/unified-ws-client.html`

To run:
```bash
cd /workspace/src/www
python3 -m http.server 8080
```

Don't forget to run the service with `npm run dev` in another terminal.

Then open `http://localhost:8080/unified-ws-client.html` in your browser.

---

## Additional Documentation

- **Authentication Guide**: See `WEBSOCKET_AUTHENTICATION.md` for detailed authentication setup
- **Test Suite**: 62 tests covering all functionality (run with `npm test`)
- **Architecture**: Unified WebSocket endpoint with action-based routing
- **Database**: SQLite for persistent block storage

---

## API Endpoints Summary

### WebSocket
- `GET /ws?userId={id}&username={name}` - Unified WebSocket endpoint

### HTTP
- `GET /health` - Health check
- `GET /ready` - Readiness check (includes database check)
- `POST /lobby/block` - Block user

---

## Error Handling

All errors are sent as:
```javascript
{
  type: "error",
  message: "Error description"
}
```

Common errors:
- `"Missing chatid"` - No chatid provided for join_chat/leave_chat/send_message
- `"Not in chat room"` - Trying to send message without joining chat first
- `"You are blocked by this user"` - Attempting to join chat with user who blocked you
- `"Already in lobby"` - Trying to join lobby when already in it
- `"Not in lobby"` - Trying to leave lobby when not in it
- `"Unknown action"` - Invalid action sent to server
