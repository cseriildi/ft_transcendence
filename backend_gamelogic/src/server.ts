import Fastify from "fastify";
import { FastifyInstance } from "fastify";
import { config, validateConfig } from "./config.js";
import { createGame } from "./gameUtils.js";
import { GameServer } from "./gameTypes.js";
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

// Health check endpoint
fastify.get("/health", async () => {
  const connectedClients = Array.from(activeGames).reduce(
    (acc, g) => acc + g.clients.size,
    0
  );
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeGames: activeGames.size,
    connectedClients,
  };
});

// WebSocket route for game
fastify.register(async function (server: FastifyInstance) {
  server.get("/game", { websocket: true }, (connection: any, req: any) => {
    console.log("Client connected");

    // Each connection manages its own game instance (so each tab has a separate game)
    let game: ReturnType<typeof createGame> | null = null;

    const stopgame = () => {
      if (game) {
        try {
          game.stop();
        } catch (err) {
          console.error("Error stopping local game:", err);
        }
        game.clients.clear();
        activeGames.delete(game);
        game = null;
      }
    };

    connection.on("message", (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("Received:", data);

        // Handle different message types
        switch (data.type) {
          case "playerInput": {
            if (!game) return; // ignore inputs if no game
            const input = data.data as { player: number; action: string };
            handlePlayerInput(game, input);
            break;
          }
          case "startGame": {
            // Stop previous game for this connection and start a fresh one
            stopgame();
            game = createGame();
            activeGames.add(game);
            game.clients.add(connection);
            game.start();
            broadcastGameSetup(game);
            break;
          }
          case "joinGame":
            // Handle player joining
            break;
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    });

    connection.on("close", () => {
      console.log("Client disconnected");
      stopgame();
    });
  });
});

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
