import Fastify from 'fastify';
import { config,validateConfig } from './config.ts';
import dbConnector from './database.ts';

validateConfig();

const app = Fastify({ logger: true });

await app.register(import('@fastify/websocket'));
await app.register(dbConnector, { path: config.database.path });

// Store active connections per chat room
const chatRooms = new Map<string, Map<any, string>>();
// Store all connected users in the lobby
const lobbyConnections = new Map<any, string>(); // connection -> username
const userLobbyConnections = new Map<string, Set<any>>(); // username -> lobby connections
const banList = new Map<string, Set<{banned: string}>>();

const chatHistory = new Map<string, Array<{
    username: string;
    message: string;
    timestamp: number;
}>>();

const MAX_MESSAGES = 20;

app.register(async (fastify) => {
    fastify.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });

    fastify.get('/ready', async (request, reply) => {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await fastify.db;
                db.get('SELECT 1', (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(true);
                });
            } catch (err) {
                reject (err);
            }
        });
    });
});

// Main lobby connection - users connect here first
app.register(async (fastify) => {
    fastify.get('/lobby', { websocket: true }, async (connection, req) => {
        const username = req.query.username as string;
        const token = req.query.token as string;
        
        if (!token || !username) {
            connection.close();
            return;
        }
        
        // Track user in lobby
        // try {
        //     const upstream = await fetch('http://localhost:3000/api/validToken');
        //     if (!upstream.ok) {
        //         connection.close();
        //         return;
        //     }
        //     const json = await upstream.json();
        //     if (!json) {
        //         connection.close();
        //         return;
        //     }
        // } catch(err) {
        //     fastify.log.error(err);
        //     connection.close();
        //     return;
        // }
        lobbyConnections.set(connection, username);
        if (!userLobbyConnections.has(username)) {
            userLobbyConnections.set(username, new Set());
        }
        userLobbyConnections.get(username)!.add(connection);
        
        // Send welcome message with all online users
        const allUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(u => u !== username);
        if (!banList.has(username)) {
            banList.set(username, new Set());
            // Send a query do a DB to populate the ban list
            const db = await fastify.db;
            db.all('SELECT blocked_user FROM blocks WHERE blocker = ?', [username], (err, rows) => {
                if (err) {
                    fastify.log.error('Error fetching ban list for %s: %s', username, err.message);
                    return;
                }
                for (const row of rows) {
                    banList.get(username)!.add({banned: row.blocked_user});
                }
            });
        }

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

    fastify.post('/block', async (request, reply) => {
        const { blocker, blocked } = request.body as { blocker: string; blocked: string; };
        if (!blocker || !blocked) {
            return reply.status(400).send({ error: 'Missing blocker or blocked username' });
        }

        if (!userLobbyConnections.has(blocker)) {
            return reply.status(401).send({ error: 'Blocking user is not authorized' });
        }
        
        // Add to in-memory ban list
        if (!banList.has(blocker)) {
            banList.set(blocker, new Set());
        }
        banList.get(blocker)!.add({banned: blocked});
        
        // Persist to database
        try {
            const db = await fastify.db;
            db.run('INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)', [blocker, blocked], (err) => {
                if (err) {
                    fastify.log.error('Error blocking user %s for %s: %s', blocked, blocker, err.message);
                    return reply.status(500).send({ error: 'Database error' });
                }
                return reply.send({ success: true });
            });
        } catch (err) {
            fastify.log.error('Database connection error: %s', String(err));
            return reply.status(500).send({ error: 'Database connection error' });
        }
    });

    // Individual chat rooms
    fastify.get('/chats/:chatid', { websocket: true }, (connection, req) => {
        const chatId = req.params.chatid;
        const username = req.query.username as string;
        
        if (!username) {
            connection.close();
            return;
        }
        
        // Check if user is banned in this chat
        const secondUser = chatId.split('-').find(u => u !== username)!;
        if (banList.has(secondUser)) {
            const bans = banList.get(secondUser)!;
            for (const ban of bans) {
                if (ban.banned === username) {
                    connection.send(JSON.stringify({
                        type: 'error',
                        message: `You are blocked by this user.`
                    }));
                    connection.close();
                    return;
                }
            }
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
        console.log(`Server is running on ${config.server.host}:${config.server.port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();