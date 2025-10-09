# Game Instance Management Guide

## Overview

The `GameServer` class now manages its own game loops internally. You can easily create multiple game instances that run independently.

## Usage

### Creating a Single Game Instance

```typescript
import { createGame } from "./server.js";

// Create and start a game
const game = createGame();

// Game loops are automatically running!
// - Physics updates at 60 FPS
// - Network broadcasts at 30 FPS
```

### Creating Multiple Game Instances

```typescript
import { GameServer } from "./gameTypes.js";
import { updateGameState } from "./gameUtils.js";
import { broadcastGameState } from "./networkUtils.js";
import { GAME_CONFIG, PHYSICS_INTERVAL, RENDER_INTERVAL } from "./config.js";

// Create multiple game instances
const games: Map<string, GameServer> = new Map();

function createNewGame(gameId: string): GameServer {
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

  // Start the game
  game.start();

  // Store it
  games.set(gameId, game);

  return game;
}

// Example: Create 3 independent games
const game1 = createNewGame("room-1");
const game2 = createNewGame("room-2");
const game3 = createNewGame("room-3");

// Each game runs independently with its own loops!
```

### Managing Game Lifecycle

```typescript
// Check if game is running
if (game.running()) {
  console.log("Game is active");
}

// Stop a game
game.stop();

// Restart a game
game.start();

// Get current game state
const state = game.getState();
console.log("Ball position:", state.ball.x, state.ball.y);
```

### WebSocket Room-Based Games

```typescript
const games: Map<string, GameServer> = new Map();

fastify.register(async function (fastify) {
  fastify.get("/game/:roomId", { websocket: true }, (connection, req) => {
    const roomId = (req.params as any).roomId;

    // Get or create game for this room
    let game = games.get(roomId);
    if (!game) {
      game = createNewGame(roomId);
      console.log(`🎮 Created new game for room: ${roomId}`);
    }

    // Add client to this game's clients
    game.clients.add(connection);

    // Send initial state
    connection.send(
      JSON.stringify({
        type: "gameState",
        data: game.getState(),
      })
    );

    connection.on("message", (message: any) => {
      const data = JSON.parse(message.toString());

      // Handle input for this specific game
      if (data.type === "playerInput") {
        handlePlayerInput(game, data.data);
      }
    });

    connection.on("close", () => {
      game!.clients.delete(connection);

      // Clean up empty games
      if (game!.clients.size === 0) {
        console.log(`🧹 Cleaning up empty game: ${roomId}`);
        game!.stop();
        games.delete(roomId);
      }
    });
  });
});

function handlePlayerInput(
  game: GameServer,
  input: { player: number; action: string }
) {
  const { player, action } = input;
  const targetPaddle = player === 1 ? game.Paddle1 : game.Paddle2;

  switch (action) {
    case "up":
      targetPaddle.ySpeed = -targetPaddle.speed;
      break;
    case "down":
      targetPaddle.ySpeed = targetPaddle.speed;
      break;
    case "stop":
      targetPaddle.ySpeed = 0;
      break;
  }
}
```

## GameServer API

### Constructor

```typescript
new GameServer(
  width: number,
  height: number,
  ballRadius: number,
  ballSpeed: number,
  paddleSpeed: number,
  physicsInterval: number,  // in milliseconds
  renderInterval: number    // in milliseconds
)
```

### Methods

#### `setUpdateCallback(callback: (game: GameServer) => void)`

Set the physics update callback (called every physics tick).

#### `setRenderCallback(callback: (game: GameServer) => void)`

Set the render/broadcast callback (called every render tick).

#### `start()`

Start the game loops. Throws error if callbacks are not set.

#### `stop()`

Stop the game loops cleanly.

#### `getState()`

Get the current game state (ball, paddles, field).

#### `running()`

Returns `true` if game loops are running, `false` otherwise.

### Properties

- `Field: Field` - Game field dimensions
- `Ball: Ball` - Ball instance
- `Paddle1: Paddle` - Player 1 paddle
- `Paddle2: Paddle` - Player 2 paddle
- `clients: Set<any>` - Connected WebSocket clients
- `physicsInterval: number` - Physics update interval (ms)
- `renderInterval: number` - Render update interval (ms)

## Benefits

1. **✅ Multiple Games**: Easy to create multiple independent game instances
2. **✅ Clean API**: Simple start/stop interface
3. **✅ Self-Contained**: Each game manages its own loops
4. **✅ No Global State**: No global game variables
5. **✅ Easy Testing**: Can create games for testing without side effects
6. **✅ Resource Management**: Stop games when not needed

## Example: Match-Based System

```typescript
interface Match {
  id: string;
  game: GameServer;
  player1Id: string;
  player2Id: string;
  createdAt: Date;
}

const activeMatches: Map<string, Match> = new Map();

function createMatch(player1Id: string, player2Id: string): Match {
  const matchId = `${player1Id}-${player2Id}-${Date.now()}`;

  const game = new GameServer(
    GAME_CONFIG.width,
    GAME_CONFIG.height,
    GAME_CONFIG.ballRadius,
    GAME_CONFIG.ballSpeed,
    GAME_CONFIG.paddleSpeed,
    PHYSICS_INTERVAL,
    RENDER_INTERVAL
  );

  game.setUpdateCallback(updateGameState);
  game.setRenderCallback(broadcastGameState);
  game.start();

  const match: Match = {
    id: matchId,
    game,
    player1Id,
    player2Id,
    createdAt: new Date(),
  };

  activeMatches.set(matchId, match);

  console.log(`🎮 Match created: ${matchId}`);
  return match;
}

function endMatch(matchId: string) {
  const match = activeMatches.get(matchId);
  if (match) {
    match.game.stop();
    activeMatches.delete(matchId);
    console.log(`🏁 Match ended: ${matchId}`);
  }
}
```
