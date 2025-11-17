import Fastify from "fastify";
import { FastifyInstance } from "fastify";
import { config, validateConfig } from "./config.js";
import { createGame, resetBall } from "./gameUtils.js";
import { GameServer, GameMode, GameStartPayload, PlayerInfo } from "./gameTypes.js";
import { broadcastGameState, broadcastGameSetup } from "./networkUtils.js";
import errorHandlerPlugin from "./plugins/errorHandlerPlugin.js";

// Validate configuration on startup
validateConfig();

const fastify: FastifyInstance = Fastify({
  logger: {
    level: config.logging.level,
  },
});

// Register plugins
await fastify.register(errorHandlerPlugin);
await fastify.register(import("@fastify/websocket"));

// NOTE: We create one game instance per WebSocket connection.
// The client will ask to start a new game (via `startGame` message).
// Track all active games so we can report health and perform graceful shutdown.
const activeGames = new Set<GameServer>();

// Track active players (userId -> game) to prevent multiple simultaneous games
// Also enables future functionality to terminate games on user logout
const activePlayers = new Map<string | number, GameServer>();

// Track the single player waiting for an opponent in ONLINE mode
// Only one player can wait at a time
let waitingRemotePlayer: {
  playerInfo: PlayerInfo;
  connection: any;
  game: GameServer;
} | null = null;

// Health check endpoint
fastify.get("/health", async () => {
  const connectedClients = Array.from(activeGames).reduce((acc, g) => acc + g.clients.size, 0);
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeGames: activeGames.size,
    connectedClients,
  };
});

// Helper function to terminate all games for a specific user (e.g., on logout)
// Can be called from an HTTP endpoint in the future
function terminateUserGames(userId: string | number): void {
  const game = activePlayers.get(userId);
  if (game) {
    try {
      // Notify clients in the game with different messages
      game.clients.forEach((client) => {
        try {
          if (client.playerInfo && client.playerInfo.userId === userId) {
            // Message for the user who logged out
            client.connection.send(
              JSON.stringify({
                type: "error",
                message: "Game terminated: You have been logged out",
              })
            );
          } else {
            // Message for the opponent
            client.connection.send(
              JSON.stringify({
                type: "error",
                message: "Game terminated: Opponent logged out",
              })
            );
          }
        } catch (err) {
          console.error("Failed to notify client:", err);
        }
      });

      // Stop the game
      game.stop();

      // Remove all players from the game from activePlayers
      game.clients.forEach((client) => {
        if (client.playerInfo && client.playerInfo.userId) {
          activePlayers.delete(client.playerInfo.userId);
        }
      });

      // Clear waiting room if needed
      if (waitingRemotePlayer && waitingRemotePlayer.game === game) {
        waitingRemotePlayer = null;
      }

      // Remove from active games
      activeGames.delete(game);
      game.clients.clear();
    } catch (err) {
      console.error(`Error terminating games for user ${userId}:`, err);
    }
  }
}

// WebSocket route for game
fastify.register(async function (server: FastifyInstance) {
  server.get("/game", { websocket: true }, (connection: any, req: any) => {
    console.log("Client connected");

    // Each connection is assigned a player number and game
    let game: ReturnType<typeof createGame> | null = null;

    const stopGame = () => {
      if (game) {
        try {
          game.stop();
        } catch (err) {
          console.error("Error stopping game:", err);
        }
        if (waitingRemotePlayer && waitingRemotePlayer.game === game) {
          waitingRemotePlayer = null;
        }
        // Remove players from active set
        game.clients.forEach((client) => {
          if (client.playerInfo && client.playerInfo.userId) {
            activePlayers.delete(client.playerInfo.userId);
          }
        });
        game.clients.clear();
        activeGames.delete(game);
        game = null;
      }
    };

    connection.on("message", (message: any) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle different message types
        switch (data.type) {
          case "playerInput": {
            if (!game) return;
            const input = data.data as { player: number; action: string };
            handlePlayerInput(game, input);
            break;
          }
          case "startGame": {
            // Validate and extract game mode and player info
            const gameStartData = data as GameStartPayload;
            const { error, gameMode, player } = validateGameStartMessage(gameStartData);

            if (error || !gameMode) {
              const errorMsg = error || "Missing required field: mode";
              console.warn("Invalid startGame message:", errorMsg);
              sendErrorToClient(connection, errorMsg);
              return;
            }

            // Check if player already has an active game (ONLINE mode only)
            // Note: validateGameStartMessage already ensures player exists for ONLINE mode
            if (
              gameMode === GameMode.ONLINE &&
              player!.userId &&
              activePlayers.has(player!.userId)
            ) {
              sendErrorToClient(
                connection,
                "You already have an active game. Please finish it before starting a new one."
              );
              return;
            }

            // Stop previous game for this connection and start a fresh one
            stopGame();

            if (gameMode === GameMode.ONLINE) {
              if (!waitingRemotePlayer || waitingRemotePlayer.connection === connection) {
                // Player 1 waiting for opponent - store in waiting room
                game = createGame(gameMode);
                waitingRemotePlayer = { playerInfo: player!, connection, game };
                game.clients.set(1, { playerInfo: player!, connection });
                activeGames.add(game);
                activePlayers.set(player!.userId, game);

                connection.send(
                  JSON.stringify({
                    type: "waiting",
                    message: "Waiting for opponent to join...",
                    gameMode: gameMode,
                    playerNumber: 1,
                  })
                );
                freezeBall(game);
              } else {
                // Player 2 joining - check if different user
                if (waitingRemotePlayer.playerInfo.userId === player!.userId) {
                  sendErrorToClient(connection, "Cannot play against yourself");
                  return;
                }

                game = waitingRemotePlayer.game;
                waitingRemotePlayer = null;
                game.clients.set(2, { playerInfo: player!, connection });
                activePlayers.set(player!.userId, game);

                connection.send(
                  JSON.stringify({
                    type: "ready",
                    message: "Ready",
                    gameMode: gameMode,
                    playerNumber: 2,
                  })
                );
                game.clients.get(1)?.connection.send(
                  JSON.stringify({
                    type: "ready",
                    message: "Opponent joined! Starting game...",
                    gameMode: gameMode,
                    playerNumber: 1,
                  })
                );
                broadcastGameSetup(game);
                runGameCountdown(game).catch((err) =>
                  console.error("Error during online game countdown:", err)
                );
              }
            } else {
              // LOCAL mode - start immediately (no player info needed)
              game = createGame(gameMode);

              game.clients.set(1, {
                playerInfo: { userId: "local", username: "local" },
                connection,
              });
              activeGames.add(game);
              freezeBall(game);

              runGameCountdown(game).catch((err) =>
                console.error("Error during local game countdown:", err)
              );
            }
            break;
          }
          case "nextGame": {
            stopGame();
            if (data.mode === GameMode.ONLINE && game) {
              activeGames.delete(game);
              activePlayers.delete(game.clients.get(1)?.playerInfo.userId!);
              activePlayers.delete(game.clients.get(2)?.playerInfo.userId!);
            }
            break;
          }
          case "joinGame":
            // Handle player joining
            break;
        }
      } catch (err) {
        console.error("Error parsing message:", err);
        sendErrorToClient(connection, "Failed to parse message");
      }
    });

    connection.on("close", () => {
      console.log("Client disconnected");

      // Notify other players in the game that someone left
      // if (game && ["remote", "friend"].includes(game.gameMode)) {
      if (game && game.gameMode === GameMode.ONLINE) {
        // Find the player who left and notify others
        game.clients.forEach((client) => {
          if (client.connection !== connection) {
            try {
              client.connection.send(
                JSON.stringify({
                  type: "playerLeft",
                  message: "Your opponent has left the game",
                })
              );
            } catch (err) {
              console.error("Failed to notify client about player leaving:", err);
            }
          }
        });
      }
      stopGame();
    });
  });
});

function freezeBall(game: GameServer): void {
  game.Ball.speedX = 0;
  game.Ball.speedY = 0;
  broadcastGameSetup(game);
  game.start();
}

// Helper function to run game countdown and start play
async function runGameCountdown(game: GameServer): Promise<void> {
  // Run 3-second countdown
  for (let i = 3; i > 0; i--) {
    if (!game.running()) break;
    game.countdown = i;
    broadcastGameState(game);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Countdown complete, release ball
  if (game.running()) {
    game.countdown = 0;
    resetBall(game);
    broadcastGameSetup(game);
  }
}

// Handle player input
function handlePlayerInput(game: GameServer, input: { player: number; action: string }) {
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

// Helper function to validate startGame message
function validateGameStartMessage(data: any): {
  error?: string;
  gameMode?: GameMode;
  player?: PlayerInfo;
} {
  // Check if mode is present
  if (!data.mode) {
    return { error: "Missing required field: mode" };
  }

  // Validate game mode
  const validModes = Object.values(GameMode);
  if (!validModes.includes(data.mode)) {
    return {
      error: `Invalid game mode: ${data.mode}. Must be one of: ${validModes.join(", ")}`,
    };
  }

  // For ONLINE mode, player info is required
  if (data.mode === GameMode.ONLINE) {
    if (!data.player) {
      return { error: "Missing required field: player" };
    }

    // Validate player info has username and userId
    if (!data.player.username) {
      return { error: "Player must have a username" };
    }

    if (!data.player.userId) {
      return { error: "Player must have a userId" };
    }
  }

  return {
    gameMode: data.mode,
    player: data.player,
  };
}

// Helper function to send error message to client
function sendErrorToClient(connection: any, error: string) {
  try {
    connection.send(
      JSON.stringify({
        type: "error",
        message: error,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Failed to send error to client:", err);
  }
}

// Start server
fastify.listen(
  { port: config.server.port, host: config.server.host },
  (err: Error | null, address: string) => {
    if (err) {
      console.error("❌ Failed to start server:", err);
      process.exit(1);
    }
    const publicPort = config.server.publicPort || config.server.port;
    const wsUrl =
      config.server.publicPort && config.server.publicPort !== ""
        ? `ws://${config.server.publicHost}:${publicPort}/game`
        : `ws://${config.server.publicHost}/game`;
    console.log(`🎮 Game server running at ${address}`);
    console.log(`🔌 WebSocket available at ${wsUrl}`);
  }
);

// Graceful shutdown
const stopAllGames = () => {
  for (const g of Array.from(activeGames)) {
    try {
      g.stop();
    } catch (err) {
      console.error("Error stopping game during shutdown:", err);
    }
    activeGames.delete(g);
  }
};

process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  stopAllGames();
  fastify.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  stopAllGames();
  fastify.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
