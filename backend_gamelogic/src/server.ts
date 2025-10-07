
import Fastify from 'fastify';
import type { FastifyInstance} from 'fastify';
import { GameServer } from "./gameTypes";
import { GAME_CONFIG, PHYSICS_INTERVAL, RENDER_INTERVAL } from './config.ts';


const fastify: FastifyInstance = Fastify({ logger: true });

await fastify.register(import('@fastify/websocket'));

// Game loop variables
const PHYSICS_FPS = 60;  // Physics updates
const RENDER_FPS = 30;   // Network updates (reduce network load)
const PHYSICS_INTERVAL = 1000 / PHYSICS_FPS;
const RENDER_INTERVAL = 1000 / RENDER_FPS;


// Initialize game objects
function initializeGame(){
  const game = new GameServer(
    GAME_CONFIG.width,
    GAME_CONFIG.height,
    GAME_CONFIG.ballRadius,
    GAME_CONFIG.ballSpeed,
    GAME_CONFIG.paddleSpeed,
    PHYSICS_INTERVAL,
    RENDER_INTERVAL
  );
  return game;

  startGameLoop();
};

// Start game loops

export const gameLoop = setInterval((game: GameServer) => {
  updateGameState(game);
}, game.updateInterval);

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

// Start server
fastify.listen({ port: 3000, host: '0.0.0.0' }, (err: Error | null, address: string) => {
  if (err) throw err;
  console.log(`Server running at ${address}`);
  console.log(`WebSocket available at ws://localhost:3000/game`);
});
