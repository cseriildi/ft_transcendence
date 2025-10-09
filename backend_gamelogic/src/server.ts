import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import { GameServer } from "./gameTypes.js";
import { config, validateConfig, PHYSICS_INTERVAL, RENDER_INTERVAL } from './config.js';
import { updateGameState } from './gameUtils.js';
import { broadcastGameState } from './networkUtils.js';
import errorHandlerPlugin from './plugins/errorHandlerPlugin.js';

// Validate configuration on startup
validateConfig();

const fastify: FastifyInstance = Fastify({ 
  logger: {
    level: config.logging.level,
  }
});

await fastify.register(import('@fastify/websocket'));

// Register plugins
await fastify.register(errorHandlerPlugin);
await fastify.register(import('@fastify/websocket'));

// Factory function to create and start a game instance
export function createGame(): GameServer {
  const game = new GameServer(
    config.game.width,
    config.game.height,
    config.game.ballRadius,
    config.game.ballSpeed,
    config.game.paddleSpeed,
    PHYSICS_INTERVAL,
    RENDER_INTERVAL
  );

  // Set up callbacks
  game.setUpdateCallback(updateGameState);
  game.setRenderCallback(broadcastGameState);

  // Start the game loops
  game.start();

  return game;
}

// Create the main game instance
const game = createGame();

// WebSocket route for game
fastify.register(async function (fastify) {
  fastify.get('/game', { websocket: true }, (connection, req) => {
    console.log('Client connected');
    
    // Add client to game's connected clients set
    game.clients.add(connection);
    
    // Send initial game state
    connection.send(JSON.stringify({
      type: 'gameState',
      data: game.getState()
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
