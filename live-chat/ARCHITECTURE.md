# Architecture Diagram

## Application Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
│  (Browser/Node.js)                                          │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
         HTTP Requests              WebSocket Connection
                │                         │
                ▼                         ▼
┌───────────────────────────────────────────────────────────────┐
│                        main.ts                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ • Initialize Fastify                                    │  │
│  │ • Register plugins (WebSocket, CORS, Rate Limit, etc.) │  │
│  │ • Register routes                                       │  │
│  │ • Start server                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                │                         │
    ┌───────────▼──────────┐  ┌──────────▼────────────┐
    │  http.routes.ts      │  │ websocket.routes.ts   │
    │                      │  │                        │
    │  ┌───────────────┐  │  │  ┌─────────────────┐  │
    │  │ GET /health   │  │  │  │ GET /ws         │  │
    │  │ GET /ready    │  │  │  │                 │  │
    │  │ POST /block   │  │  │  │ • Validate conn │  │
    │  └───────────────┘  │  │  │ • Load ban list │  │
    │                      │  │  │ • Route actions │  │
    └──────────────────────┘  │  └─────────────────┘  │
                              │                        │
                              │   Action Router:       │
                              │   ┌─────────────────┐  │
                              │   │ join_lobby      │──┼──┐
                              │   │ leave_lobby     │──┼──┤
                              │   │ join_chat       │──┼──┤
                              │   │ leave_chat      │──┼──┤
                              │   │ send_message    │──┼──┤
                              │   └─────────────────┘  │  │
                              └────────────────────────┘  │
                                                          │
                   ┌──────────────────────────────────────┘
                   │
    ┌──────────────▼──────────────┐    ┌─────────────────────┐
    │   lobby.handler.ts          │    │   chat.handler.ts   │
    │                             │    │                     │
    │  ┌──────────────────────┐  │    │  ┌──────────────┐  │
    │  │ handleJoinLobby()    │  │    │  │ handleJoinChat() │
    │  │ handleLeaveLobby()   │  │    │  │ handleLeaveChat()│
    │  │ cleanupLobby()       │  │    │  │ handleSendMessage()
    │  └──────────────────────┘  │    │  │ cleanupChats()   │
    │                             │    │  └──────────────┘  │
    └──────────────┬──────────────┘    └──────────┬──────────┘
                   │                              │
                   │                              │
                   └──────────┬───────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │    state.ts         │
                   │                     │
                   │  • chatRooms        │
                   │  • lobbyConnections │
                   │  • userLobbyConnections
                   │  • banList          │
                   │  • chatHistory      │
                   │  • MAX_MESSAGES     │
                   └──────────┬──────────┘
                              │
                   ┌──────────▼──────────┐
                   │    database.ts      │
                   │                     │
                   │  • SQLite3          │
                   │  • blocks table     │
                   └─────────────────────┘
```

## Module Dependencies

```
main.ts
  ├── config.ts
  ├── database.ts
  ├── routes/
  │   ├── http.routes.ts
  │   │   └── services/state.ts
  │   └── websocket.routes.ts
  │       ├── services/state.ts
  │       ├── handlers/lobby.handler.ts
  │       │   └── services/state.ts
  │       └── handlers/chat.handler.ts
  │           └── services/state.ts
  └── Fastify plugins
      ├── @fastify/websocket
      ├── @fastify/cors
      ├── @fastify/rate-limit
      └── @fastify/helmet
```

## Data Flow - Lobby Join Example

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. Send: { action: "join_lobby" }
     ▼
┌──────────────────────┐
│ websocket.routes.ts  │
│                      │
│ • Parse message      │
│ • Switch on action   │
└──────┬───────────────┘
       │
       │ 2. Call handleJoinLobby(connection, username, inLobby)
       ▼
┌──────────────────────┐
│ lobby.handler.ts     │
│                      │
│ • Check if in lobby  │
│ • Add to lobby       │
│ • Get user list      │
└──────┬───────────────┘
       │
       │ 3. Access/Update State
       ▼
┌──────────────────────┐
│     state.ts         │
│                      │
│ • lobbyConnections   │
│ • userLobbyConn...   │
└──────┬───────────────┘
       │
       │ 4. Return user list
       ▼
┌──────────────────────┐
│ lobby.handler.ts     │
│                      │
│ • Send welcome msg   │
│ • Broadcast update   │
└──────┬───────────────┘
       │
       │ 5. Send: { type: "lobby_connected", allUsers: [...] }
       ▼
┌──────────┐
│  Client  │
└──────────┘
```

## Data Flow - Send Message Example

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. Send: { action: "send_message", chatid: "alice-bob", message: "Hi!" }
     ▼
┌──────────────────────┐
│ websocket.routes.ts  │
│                      │
│ • Parse message      │
│ • Route to handler   │
└──────┬───────────────┘
       │
       │ 2. Call handleSendMessage(connection, username, chatid, message, userChatRooms)
       ▼
┌──────────────────────┐
│  chat.handler.ts     │
│                      │
│ • Validate params    │
│ • Check in room      │
│ • Check blocked      │
└──────┬───────────────┘
       │
       │ 3. Access State
       ▼
┌──────────────────────┐
│     state.ts         │
│                      │
│ • chatRooms          │
│ • banList            │
│ • chatHistory        │
└──────┬───────────────┘
       │
       │ 4. Get room & check bans
       ▼
┌──────────────────────┐
│  chat.handler.ts     │
│                      │
│ • Save to history    │
│ • Broadcast message  │
└──────┬───────────────┘
       │
       │ 5. Send to other users: { type: "message", chatid: "alice-bob", ... }
       ▼
┌──────────┐
│  Other   │
│  Clients │
└──────────┘
```

## HTTP vs WebSocket Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Requests                          │
└─────────────────────────────────────────────────────────────┘

GET /health
    └──> http.routes.ts
         └──> Return { status: "ok" }

GET /ready
    └──> http.routes.ts
         └──> Check database
              └──> Return success/error

POST /lobby/block
    └──> http.routes.ts
         └──> Validate blocker in lobby
              └──> Update state.banList
                   └──> Save to database
                        └──> Return { success: true }

┌─────────────────────────────────────────────────────────────┐
│                   WebSocket Messages                        │
└─────────────────────────────────────────────────────────────┘

{ action: "join_lobby" }
    └──> websocket.routes.ts
         └──> lobby.handler.handleJoinLobby()
              └──> Update state.lobbyConnections
                   └──> Send { type: "lobby_connected", ... }

{ action: "join_chat", chatid: "alice-bob" }
    └──> websocket.routes.ts
         └──> chat.handler.handleJoinChat()
              └──> Update state.chatRooms
                   └──> Send { type: "chat_connected", ... }

{ action: "send_message", chatid: "alice-bob", message: "Hi" }
    └──> websocket.routes.ts
         └──> chat.handler.handleSendMessage()
              └──> Update state.chatHistory
                   └──> Broadcast { type: "message", ... }
```

## State Management Architecture

```
┌───────────────────────────────────────────────────────────┐
│                      state.ts                             │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         In-Memory State (Maps & Sets)               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  chatRooms:              Map<chatId, Map<conn, username>> │
│  ├─ "alice-bob" ──> Map<conn1, "alice">                  │
│  └─ "bob-charlie" ─> Map<conn2, "bob">                   │
│                                                           │
│  lobbyConnections:       Map<connection, username>        │
│  ├─ conn1 ──> "alice"                                     │
│  ├─ conn2 ──> "bob"                                       │
│  └─ conn3 ──> "charlie"                                   │
│                                                           │
│  userLobbyConnections:   Map<username, Set<connection>>   │
│  ├─ "alice" ──> Set(conn1)                                │
│  └─ "bob" ────> Set(conn2, conn4)  [multiple devices]    │
│                                                           │
│  banList:                Map<username, Set<{banned}>>     │
│  ├─ "alice" ──> Set({banned: "charlie"})                 │
│  └─ "bob" ────> Set({banned: "alice"})                   │
│                                                           │
│  chatHistory:            Map<chatId, Array<message>>      │
│  ├─ "alice-bob" ──> [{username, message, timestamp}, ...] │
│  └─ "bob-charlie" ─> [{...}, {...}, ...]                 │
│                                                           │
└───────────────────────────────────────────────────────────┘
                            │
                            │ Persisted
                            ▼
                ┌───────────────────────┐
                │    database.ts        │
                │                       │
                │  blocks table:        │
                │  ┌─────────────────┐  │
                │  │ blocker         │  │
                │  │ blocked_user    │  │
                │  └─────────────────┘  │
                └───────────────────────┘
```

## Connection Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                  Connection Lifecycle                       │
└─────────────────────────────────────────────────────────────┘

1. Connection Established
   ┌────────────────────────────────────┐
   │ WebSocket Connect                  │
   │ ws://host/ws?userId=1&username=alice│
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ websocket.routes.ts                │
   │ • Validate username & userId       │
   │ • Load ban list from database      │
   │ • Set up message handler           │
   │ • Set up close handler             │
   └────────────────────────────────────┘

2. Active Connection
   ┌────────────────────────────────────┐
   │ User sends messages                │
   │ { action: "..." }                  │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ Action Router (switch statement)   │
   │ • join_lobby ──> lobby.handler     │
   │ • join_chat ───> chat.handler      │
   │ • send_message ─> chat.handler     │
   │ • etc.                             │
   └────────────────────────────────────┘

3. Connection Closed
   ┌────────────────────────────────────┐
   │ WebSocket Close Event              │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ Cleanup Handlers                   │
   │ • cleanupLobbyConnection()         │
   │ • cleanupChatConnections()         │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ State Cleanup                      │
   │ • Remove from lobbyConnections     │
   │ • Remove from chatRooms            │
   │ • Broadcast disconnection          │
   │ • Clean up empty rooms             │
   └────────────────────────────────────┘
```

## Testing Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Tests                                │
└────────────────────────────────────────────────────────────┘

tests/
├── config.test.ts          → Tests config validation
├── database.test.ts        → Tests database operations
├── main.test.ts            → Tests HTTP endpoints
├── websocket-lobby.test.ts → Tests lobby functionality
│   ├── Connection auth
│   ├── Bearer token auth
│   ├── User list management
│   └── User disconnect
└── websocket-chat.test.ts  → Tests chat functionality
    ├── Chat connection
    ├── Message broadcasting
    ├── Chat history
    ├── Blocking
    └── Room isolation

All tests create isolated Fastify instances and don't share state.
Tests pass regardless of module structure (decoupled from implementation).
Tests import from ../src/ to access application code.
```
