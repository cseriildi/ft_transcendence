
import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import { GameServer } from "./gameTypes.js";
import { GAME_CONFIG, PHYSICS_INTERVAL, RENDER_INTERVAL } from './config.js';
import { updateGameState } from './gameUtils.js';
import { broadcastGameState } from './networkUtils.js';

const fastify: FastifyInstance = Fastify({ logger: true });

await fastify.register(import('@fastify/websocket'));

export function setupGameServer() {
  
}
// Initialize game instance
const game = new GameServer(
  GAME_CONFIG.width,
  GAME_CONFIG.height,
  GAME_CONFIG.ballRadius,
  GAME_CONFIG.ballSpeed,
  GAME_CONFIG.paddleSpeed,
  PHYSICS_INTERVAL,
  RENDER_INTERVAL
);

console.log('✅ Game server initialized');

// Start physics update loop (high frequency)
const physicsLoop = setInterval(() => {
  updateGameState(game);
}, PHYSICS_INTERVAL);

// Start network broadcast loop (lower frequency to reduce network load)
const renderLoop = setInterval(() => {
  broadcastGameState(game);
}, RENDER_INTERVAL);

// Game state (initial state for new connections)
function getInitialGameState(game: GameServer) {
  const paddle1Capsule = game.Paddle1.getCapsule();
  const paddle2Capsule = game.Paddle2.getCapsule();
  
  return {
    field: {
      width: game.Field.width,
      height: game.Field.height
    },
    ball: {
      x: game.Ball.x,
      y: game.Ball.y,
      radius: game.Ball.radius,
      speedX: game.Ball.speedX,
      speedY: game.Ball.speedY
    },
    paddle1: {
      cx: game.Paddle1.cx,
      cy: game.Paddle1.cy,
      length: game.Paddle1.length,
      width: game.Paddle1.width,
      radius: paddle1Capsule.R,
      capsule: paddle1Capsule
    },
    paddle2: {
      cx: game.Paddle2.cx,
      cy: game.Paddle2.cy,
      length: game.Paddle2.length,
      width: game.Paddle2.width,
      radius: paddle2Capsule.R,
      capsule: paddle2Capsule
    }
  };
}

// WebSocket route for game
fastify.register(async function (fastify) {
  fastify.get('/game', { websocket: true }, (connection, req) => {
    console.log('Client connected');
    
    // Add client to game's connected clients set
    game.clients.add(connection);
    
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
      game.clients.delete(connection);
    });
  });
});

// Handle player input
function handlePlayerInput(input: { player: number, action: string }) {
  const { player, action } = input;
  const targetPaddle = player === 1 ? game.Paddle1 : game.Paddle2;
  
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

// Start server
const PORT = 3000;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err: Error | null, address: string) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🎮 Game server running at ${address}`);
  console.log(`🔌 WebSocket available at ws://localhost:${PORT}/game`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  clearInterval(physicsLoop);
  clearInterval(renderLoop);
  fastify.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  clearInterval(physicsLoop);
  clearInterval(renderLoop);
  fastify.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
