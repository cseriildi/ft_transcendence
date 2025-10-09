import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import { config, validateConfig} from './config.js';
import { createGame } from './gameUtils.js';
import {broadcastGameState, broadcastGameSetup} from './networkUtils.js';
import errorHandlerPlugin from './plugins/errorHandlerPlugin.js';

// Validate configuration on startup
validateConfig();

const fastify: FastifyInstance = Fastify({ 
  logger: {
    level: config.logging.level,
  }
});

// Register plugins
await fastify.register(errorHandlerPlugin);
await fastify.register(import('@fastify/websocket'));

// Create the main game instance
const game = createGame();

// WebSocket route for game
fastify.register(async function (fastify) {
  fastify.get('/game', { websocket: true }, (connection, req) => {
    console.log('Client connected');
    
    // Add client to game's connected clients set
    game.clients.add(connection);
    
    // Send initial game state
    broadcastGameSetup(game);

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
fastify.listen({ port: config.server.port, host: config.server.host }, (err: Error | null, address: string) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🎮 Game server running at ${address}`);
  console.log(`🔌 WebSocket available at ws://localhost:${config.server.port}/game`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  game.stop();
  fastify.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  game.stop();
  fastify.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
