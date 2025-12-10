import Fastify from "fastify";
import { FastifyInstance } from "fastify";
import { config, VALID_MODES, validateConfig } from "./config.js";
import { sendErrorToClient } from "./networkUtils.js";
import errorHandlerPlugin from "./plugins/errorHandlerPlugin.js";
import { GameManager } from "./gameManager.js";
import LocalConnection from "./connection/LocalConnection.js";
import AIConnection from "./connection/AIConnection.js";
import RemoteConnection from "./connection/RemoteConnection.js";
import FriendConnection from "./connection/FriendConnection.js";
import TournamentConnection from "./connection/TournamentConnection.js";
import { verifyAccessToken, fetchUsername } from "./utils/authUtils.js";
import ConnectionSession from "./connection/ConnectionSession.js";

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

// Create single GameManager instance for all game tracking and lifecycle management
const gameManager = new GameManager();

// Health check endpoint
fastify.get("/health", async () => {
  const activeGames = gameManager.getActiveGames();
  const connectedClients = Array.from(activeGames).reduce((acc, g) => acc + g.clients.size, 0);
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
  server.get("/game", { websocket: true }, async (connection: any, req: any) => {
    console.log("Client connected");

    let session: ConnectionSession | null = null;
    const messageQueue: any[] = [];

    // Set up message listener IMMEDIATELY before async operations
    connection.on("message", (raw: any) => {
      if (session) {
        session.onMessage(raw);
      } else {
        messageQueue.push(raw);
      }
    });

    connection.on("close", () => {
      if (session) {
        try {
          console.log(`🔵 Connection closed for ${session.mode} mode`);
          session.onClose();
        } catch (err) {
          console.error(`🔴 Error handling close for ${session.mode}:`, err);
        }
        session.game = null;
      }
    });

    connection.on("error", (err: any) => {
      console.error("❌ WebSocket error event:", err);
    });

    try {
      // Extract mode from query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const mode = url.searchParams.get("mode");
      const gameId = url.searchParams.get("gameId") || undefined;

      // Validate mode
      if (!mode || !VALID_MODES.includes(mode)) {
        sendErrorToClient(
          connection,
          `Invalid or missing mode. Must be one of: ${VALID_MODES.join(", ")}`
        );
        connection.close();
        return;
      }
      if (["friend"].includes(mode) && !gameId) {
        sendErrorToClient(connection, "Missing gameId for friend mode");
        connection.close();
        return;
      }

      let userId: number | undefined;
      let username: string | undefined;
      let token: string | undefined;

      if (["remote", "friend"].includes(mode)) {
        token = url.searchParams.get("token") || undefined;

        if (!token) {
          connection.close();
          return;
        }

        try {
          userId = await verifyAccessToken(token);

          // Fetch username from database
          username = await fetchUsername(userId, token);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Token verification failed";
          sendErrorToClient(connection, `Authentication failed: ${errorMessage}`);
          connection.close();
          return;
        }
      }

      try {
        switch (mode) {
          case "local":
            session = new LocalConnection(connection, req, mode, gameManager);
            break;
          case "ai":
            session = new AIConnection(connection, req, mode, gameManager);
            break;
          case "remote":
            session = new RemoteConnection(connection, req, mode, gameManager, userId!, username!);
            break;
          case "friend":
            session = new FriendConnection(
              connection,
              req,
              mode,
              gameManager,
              userId!,
              username!,
              gameId!
            );
            break;
          case "tournament":
            session = new TournamentConnection(connection, req, mode, gameManager);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error(`❌ Error creating session for ${mode}:`, err);
        throw err;
      }
      // Process any queued messages
      if (messageQueue.length > 0) {
        for (const queuedMessage of messageQueue) {
          if (session) {
            await session.onMessage(queuedMessage);
          }
        }
        messageQueue.length = 0;
      }
    } catch (err) {
      console.error("❌ WebSocket handler error:", err);
      try {
        sendErrorToClient(
          connection,
          `Server error: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } catch (e) {}
      connection.close();
    }
  });
});

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
process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  gameManager.stopAllGames();
  fastify.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  gameManager.stopAllGames();
  fastify.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
