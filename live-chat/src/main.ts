import Fastify from 'fastify';

const app = Fastify({ logger: true });

await app.register(import('@fastify/websocket'));

// Store active connections per chat room
const chatRooms = new Map<string, Map<any, string>>();
// Store all connected users in the lobby
const lobbyConnections = new Map<any, string>(); // connection -> username
const userLobbyConnections = new Map<string, Set<any>>(); // username -> lobby connections

const chatHistory = new Map<string, Array<{
    username: string;
    message: string;
    timestamp: number;
}>>();

const MAX_MESSAGES = 20;

// Main lobby connection - users connect here first
app.register(async (fastify) => {
    fastify.get('/lobby', { websocket: true }, (connection, req) => {
        const username = req.query.username as string;
        
        if (!username) {
            connection.close();
            return;
        }
        
        // Track user in lobby
        lobbyConnections.set(connection, username);
        if (!userLobbyConnections.has(username)) {
            userLobbyConnections.set(username, new Set());
        }
        userLobbyConnections.get(username)!.add(connection);
        
        // Send welcome message with all online users
        const allUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(u => u !== username);
        
        connection.send(JSON.stringify({
            type: 'lobby_connected',
            message: `Welcome ${username}! You are now online.`,
            allUsers: allUsersList
        }));
        
        // Broadcast to all lobby users that someone new is online
        for (const [otherConn, otherUsername] of lobbyConnections) {
            if (otherConn !== connection) {
                const otherUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(u => u !== otherUsername);
                otherConn.send(JSON.stringify({
                    type: 'user_list_update',
                    allUsers: otherUsersList
                }));
            }
        }
        
        connection.on('close', () => {
            lobbyConnections.delete(connection);
            
            const userConns = userLobbyConnections.get(username);
            if (userConns) {
                userConns.delete(connection);
                if (userConns.size === 0) {
                    userLobbyConnections.delete(username);
                }
            }
            
            // Broadcast to all lobby users that someone went offline
            const allUsersList = Array.from(new Set(userLobbyConnections.keys()));
            for (const [otherConn, otherUsername] of lobbyConnections) {
                otherConn.send(JSON.stringify({
                    type: 'user_list_update',
                    allUsers: allUsersList.filter(u => u !== otherUsername)
                }));
            }
        });
    });
    
    // Individual chat rooms
    fastify.get('/chats/:chatid', { websocket: true }, (connection, req) => {
        const chatId = req.params.chatid;
        const username = req.query.username as string;
        
        if (!username) {
            connection.close();
            return;
        }
        
        // Initialize chat room if it doesn't exist
        if (!chatRooms.has(chatId)) {
            chatRooms.set(chatId, new Map());
        }
        
        const room = chatRooms.get(chatId)!;
        room.set(connection, username);
        
        // Get chat history for this room
        const history = chatHistory.get(chatId) || [];
        
        // Send welcome message with history
        connection.send(JSON.stringify({
            type: 'chat_connected',
            message: `Connected to chat: ${chatId}`,
            history: history
        }));
        
        // Notify others in the room that user is active in this chat
        for (const [client, clientUsername] of room) {
            if (client !== connection) {
                client.send(JSON.stringify({
                    type: 'system',
                    message: `${username} opened the chat.`
                }));
            }
        }
        
        connection.on('message', (message) => {
            // Save message to history
            if (!chatHistory.has(chatId)) {
                chatHistory.set(chatId, []);
            }
            const history = chatHistory.get(chatId)!;
            history.push({
                username,
                message: message.toString(),
                timestamp: Date.now()
            });
            if (history.length > MAX_MESSAGES) {
                history.shift(); // Remove oldest message
            }
            
            // Broadcast incoming message to all connected clients in the same room
            for (const [client, clientUsername] of room) {
                if (client !== connection) {
                    client.send(JSON.stringify({
                        type: 'message',
                        username: username,
                        message: message.toString(),
                        timestamp: Date.now()
                    }));
                }
            }
        });
        
        connection.on('close', () => {
            room.delete(connection);
            
            // Notify others in the room
            for (const [client, clientUsername] of room) {
                client.send(JSON.stringify({
                    type: 'system',
                    message: `${username} closed the chat.`
                }));
            }
            
            // Clean up empty rooms
            if (room.size === 0) {
                chatRooms.delete(chatId);
            }
        });
    });
});

const start = async () => {
    try {
        await app.listen({ port: 3002, host: '::' });
        console.log('Server is running on http://localhost:3002');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();