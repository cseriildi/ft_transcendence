import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Field, Ball, Paddle, collideBallCapsule, collideBallWithWalls } from './game.ts';

dotenv.config();

const fastify: FastifyInstance = Fastify({ logger: true });

// Register WebSocket plugin
await fastify.register(import('@fastify/websocket'));

// Open SQLite database (async)
let db: Database | undefined;
async function initDB(): Promise<void> {
  // Ensure database directory exists
  const dbDir = path.resolve('./database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = await open({
    filename: './database/transcendenceDB.db',
    driver: sqlite3.Database
  });

  // Create table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE
    )
  `);
}

await initDB();

// Initialize game objects
const field = new Field();
const ball = new Ball(field);
const paddle1 = new Paddle(1, field); // Left paddle
const paddle2 = new Paddle(2, field); // Right paddle

// Store connected clients
const clients = new Set<any>();

// Game loop variables
const PHYSICS_FPS = 60;  // Physics updates
const RENDER_FPS = 30;   // Network updates (reduce network load)
const PHYSICS_INTERVAL = 1000 / PHYSICS_FPS;
const RENDER_INTERVAL = 1000 / RENDER_FPS;

// Game state update function
function updateGameState() {
  // Update ball position
  ball.x += ball.speedX;
  ball.y += ball.speedY;
  
  // Check wall collisions
  collideBallWithWalls(ball, field);
  
  // Check paddle collisions
  collideBallCapsule(paddle1, ball);
  collideBallCapsule(paddle2, ball);
  
  // Update paddle positions (apply ySpeed)
  paddle1.cy += paddle1.ySpeed;
  paddle2.cy += paddle2.ySpeed;
  
  // Keep paddles within bounds
  const paddleHalfLength = paddle1.length / 2;
  paddle1.cy = Math.max(paddleHalfLength, Math.min(paddle1.cy, field.height - paddleHalfLength));
  paddle2.cy = Math.max(paddleHalfLength, Math.min(paddle2.cy, field.height - paddleHalfLength));
}

// Broadcast game state to all connected clients
function broadcastGameState() {
  const paddle1Capsule = paddle1.getCapsule();
  const paddle2Capsule = paddle2.getCapsule();
  
  const gameState = {
    field: {
      width: field.width,
      height: field.height
    },
    ball: {
      x: ball.x,
      y: ball.y,
      radius: ball.radius,
      speedX: ball.speedX,
      speedY: ball.speedY
    },
    paddle1: {
      cx: paddle1.cx,
      cy: paddle1.cy,
      length: paddle1.length,
      width: paddle1.width,
      radius: paddle1Capsule.R,
      capsule: paddle1Capsule
    },
    paddle2: {
      cx: paddle2.cx,
      cy: paddle2.cy,
      length: paddle2.length,
      width: paddle2.width,
      radius: paddle2Capsule.R,
      capsule: paddle2Capsule
    }
  };

  const message = JSON.stringify({
    type: 'gameState',
    data: gameState
  });

  // Send to all connected clients
  for (const client of clients) {
    try {
      client.send(message);
    } catch (err) {
      // Remove client if sending fails
      clients.delete(client);
    }
  }
}

// Start game loops
setInterval(() => {
  updateGameState();
}, PHYSICS_INTERVAL);

setInterval(() => {
  broadcastGameState();
}, RENDER_INTERVAL);

// Game state (initial state for new connections)
function getInitialGameState() {
  const paddle1Capsule = paddle1.getCapsule();
  const paddle2Capsule = paddle2.getCapsule();
  
  return {
    field: {
      width: field.width,
      height: field.height
    },
    ball: {
      x: ball.x,
      y: ball.y,
      radius: ball.radius,
      speedX: ball.speedX,
      speedY: ball.speedY
    },
    paddle1: {
      cx: paddle1.cx,
      cy: paddle1.cy,
      length: paddle1.length,
      width: paddle1.width,
      radius: paddle1Capsule.R,
      capsule: paddle1Capsule
    },
    paddle2: {
      cx: paddle2.cx,
      cy: paddle2.cy,
      length: paddle2.length,
      width: paddle2.width,
      radius: paddle2Capsule.R,
      capsule: paddle2Capsule
    }
  };
}

// WebSocket route for game
fastify.register(async function (fastify) {
  fastify.get('/game', { websocket: true }, (connection, req) => {
    console.log('Client connected');
    
    // Add client to connected clients set
    clients.add(connection);
    
    // Send initial game state
    connection.send(JSON.stringify({
      type: 'gameState',
      data: getInitialGameState()
    }));

    connection.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);
        
        // Handle different message types
        switch (data.type) {
          case 'playerInput':
            handlePlayerInput(data.data);
            break;
          case 'joinGame':
            // Handle player joining
            break;
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    });

    connection.on('close', () => {
      console.log('Client disconnected');
      clients.delete(connection);
    });
  });
});

// Handle player input
function handlePlayerInput(input: { player: number, action: string }) {
  const { player, action } = input;
  const targetPaddle = player === 1 ? paddle1 : paddle2;
  
  switch (action) {
    case 'up':
      targetPaddle.ySpeed = -targetPaddle.speed;
      break;
    case 'down':
      targetPaddle.ySpeed = targetPaddle.speed;
      break;
    case 'stop':
      targetPaddle.ySpeed = 0;
      break;
  }
}

// Routes
fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  if (!db) return [];
  const users = await db.all('SELECT * FROM users');
  return users;
});

fastify.post('/users', async (request: FastifyRequest, reply: FastifyReply) => {
  if (!db) return { error: 'Database not initialized' };
  const { name, email } = request.body as { name: string; email: string };

  try {
    const result = await db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
    return { id: result.lastID };
  } catch (err: any) {
    reply.status(400);
    return { error: err.message };
  }
});

// Serve static files
fastify.register(import('@fastify/static'), {
  root: path.join(process.cwd(), 'public'),
  prefix: '/'
});

// Start server
fastify.listen({ port: 3000 }, (err: Error | null, address: string) => {
  if (err) throw err;
  console.log(`Server running at ${address}`);
  console.log(`WebSocket available at ws://localhost:3000/game`);
});
