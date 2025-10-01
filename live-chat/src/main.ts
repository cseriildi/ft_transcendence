import Fastify from 'fastify';
import type WebSocket from 'ws';

const app = Fastify({ logger: true });

await app.register(import('@fastify/websocket'));

// Store active connections per chat room
const chatRooms = new Map<string, Map<any, string>>();
// Store all connected users globally (for user list)
const allUsers = new Map<any, string>(); // connection -> username
const userConnections = new Map<string, Set<any>>(); // username -> connections

app.register(async (fastify) => {
    fastify.get('/:chatid', { websocket: true }, (connection, req) => {
        const chatId = req.params.chatid;
        const username = req.query.username as string;
        
        // Track user globally
        allUsers.set(connection, username);
        if (!userConnections.has(username)) {
            userConnections.set(username, new Set());
        }
        userConnections.get(username)!.add(connection);
        
        // Initialize chat room if it doesn't exist
        if (!chatRooms.has(chatId)) {
            chatRooms.set(chatId, new Map());
        }
        
        const room = chatRooms.get(chatId)!;
        room.set(connection, username);
        
        // Send welcome message with user list
        const usersInRoom = Array.from(new Set(room.values()));
        const allUsersList = Array.from(new Set(userConnections.keys()));
        
        connection.send(JSON.stringify({
            type: 'system',
            message: `Hello ${username}! You are connected to chat room: ${chatId}`,
            usersInRoom,
            allUsers: allUsersList.filter(u => u !== username)
        }));
        
        // Notify others in the room and send updated user lists
        for (const [client, clientUsername] of room) {
            if (client !== connection) {
                client.send(JSON.stringify({
                    type: 'system',
                    message: `${username} has joined the chat.`,
                    usersInRoom,
                    allUsers: allUsersList.filter(u => u !== clientUsername)
                }));
            }
        }
        
        // Broadcast to all users that someone new is online
        for (const [otherConn, otherUsername] of allUsers) {
            if (otherConn !== connection) {
                const otherUsersList = Array.from(new Set(userConnections.keys())).filter(u => u !== otherUsername);
                otherConn.send(JSON.stringify({
                    type: 'user_list_update',
                    allUsers: otherUsersList
                }));
            }
        }
        
        connection.on('message', (message) => {
            // Broadcast incoming message to all connected clients in the same room
            for (const [client, clientUsername] of room) {
                if (client !== connection) {
                    client.send(JSON.stringify({
                        type: 'message',
                        username: username,
                        message: message.toString()
                    }));
                }
            }
        });
        
        connection.on('close', () => {
            room.delete(connection);
            allUsers.delete(connection);
            
            const userConns = userConnections.get(username);
            if (userConns) {
                userConns.delete(connection);
                if (userConns.size === 0) {
                    userConnections.delete(username);
                }
            }
            
            const usersInRoom = Array.from(new Set(room.values()));
            
            // Notify others in the room
            for (const [client, clientUsername] of room) {
                client.send(JSON.stringify({
                    type: 'system',
                    message: `${username} has disconnected.`,
                    usersInRoom
                }));
            }
            
            // Broadcast to all users that someone went offline
            const allUsersList = Array.from(new Set(userConnections.keys()));
            for (const [otherConn, otherUsername] of allUsers) {
                otherConn.send(JSON.stringify({
                    type: 'user_list_update',
                    allUsers: allUsersList.filter(u => u !== otherUsername)
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