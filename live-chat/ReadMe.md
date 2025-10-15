# Simple chat setup:
## Integration
### Initial request to connect user to lobby by front-end should be done using WS
```javascript
// Example using JavaScript (browser environment)
// Pass userId and username as query parameters, and token via Authorization header (if using a library that supports headers)

const userId = 123;
const username = "alice";
const token = "<token>";

// Construct the WebSocket URL with query parameters
const wsUrl = `ws://host/lobby?userId=${userId}&username=${encodeURIComponent(username)}`;

// Native browser WebSocket does not support custom headers.
// If you need to send the Authorization header, use a library like 'ws' (Node.js) or 'socket.io'.
// Example with 'ws' (Node.js):
/*
const WebSocket = require('ws');
const ws = new WebSocket(wsUrl, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
*/

// For browser, you may need to pass the token as a query parameter if the server supports it:
// const wsUrl = `ws://host/lobby?userId=${userId}&username=${encodeURIComponent(username)}&token=${token}`;
// const ws = new WebSocket(wsUrl);
```

### In return Front End receives a list of all active users to output in the lobby
```javascript
{
    type: "lobby_connected",
    allUsers: string[],
}
```

### Already active users receive another message
```javascript
{
    type: "user_list_update",
    allUsers: string[],
}
```

# One WS should be enough to communicate.

## Chat connection
### Clients connect to chat using /chats/:chatid route, in which 'chatid' is a string containing sorted usernames of users separated by dash. ("chats/user1-user2"). 
### After connection is successful, Client receives a message 
```javascript
{
    type: "chat_connected",
    message: `Connected to chat ${chatId}`,
    history: {
        username: string,
        message: string,
        timestamp: number,
    }[],
}
``` 

### If a Client is blocked by another user, Client receives
```javascript
{
    type: "error",
    message: "You are blocked by this user and cannot send messages",
}
```

### Common messages are constructed in a following way and are not received by a sender, because front end can take care of outputting a message on a sender page before it reaches the receiver.
```javascript
{
    type: "message",
    username: string,
    message: string,
    timestamp: number,
}
```

### When Client leaves the chatroom, other user will receive a message
```javascript
{
    type: "system",
    message: `${username} has left`
}
```
### this should stop user from sending any messages to offline user.

### When user opens the chat window the other user will receive
```javascript
{
    type: "system",
    message: `${username} is online`
}
```

## Blocking
### Clients should be able to block each other using route /lobby/block using POST request and request body
```javascript
{
    blocker: string,
    blocked: string,
}
```
### Whether or not to pass access token for this request is not decided for now.

### Client receives OK on successful block.
