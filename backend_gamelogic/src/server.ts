
import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import { GameServer } from "./gameTypes.js";
import { GAME_CONFIG, PHYSICS_INTERVAL, RENDER_INTERVAL } from './config.js';
import { updateGameState } from './gameUtils.js';
import { broadcastGameState } from './networkUtils.js';

const fastify: FastifyInstance = Fastify({ logger: true });

await fastify.register(import('@fastify/websocket'));

// Factory function to create and start a game instance
export function createGame(): GameServer {
  const game = new GameServer(
    GAME_CONFIG.width,
    GAME_CONFIG.height,
    GAME_CONFIG.ballRadius,
    GAME_CONFIG.ballSpeed,
    GAME_CONFIG.paddleSpeed,
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

// No longer needed - use game.getState() directly

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
