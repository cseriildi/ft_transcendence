# Simple chat setup:
## Integration
### Initial request to connect user to lobby by front-end should be done using WS
```javascript
{
    method: 'GET'
    headers: {
        'Content-type': 'application/json'
        'Authorization': 'Bearer ${token}',
    }
    body: {
        userId: number,
        username: string,
    },
}
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
