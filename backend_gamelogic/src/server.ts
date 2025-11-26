import Fastify from "fastify";
import { FastifyInstance } from "fastify";
import { config, VALID_MODES, validateConfig } from "./config.js";
import { createGame, resetBall } from "./gameUtils.js";
import { GameServer, GameStartPayload, PlayerInfo } from "./gameTypes.js";
import { broadcastGameState, broadcastGameSetup, sendErrorToClient } from "./networkUtils.js";
import errorHandlerPlugin from "./plugins/errorHandlerPlugin.js";
import { Tournament, TournamentPlayer } from "./Tournament.js";
import { join } from "path";

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
// The client will ask to start a new game (via `newGame` message).
// Track all active games so we can report health and perform graceful shutdown.
const activeGames = new Set<GameServer>();

// Track active players (userId -> game) to prevent multiple simultaneous games
// Also enables future functionality to terminate games on user logou
const activePlayers = new Map<
  number,
  { online: GameServer | null; friend: Map<string, GameServer> | null }
>();
const activeTournaments = new Set<Tournament>();

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

function addGame(userId: number, game: GameServer, gameId?: string) {
  const user = activePlayers.get(userId);
  if (!user) {
    activePlayers.set(
      userId,
      !gameId ? { online: game, friend: null } : { online: null, friend: new Map([[gameId, game]]) }
    );
    return;
  }
  if (!gameId) {
    user.online = game;
    return;
  }
  if (!user.friend) user.friend = new Map();
  user.friend.set(gameId, game);
}

function removeGame(userId: number, gameId?: string) {
  const user = activePlayers.get(userId);
  if (!user) return;
  if (!gameId) user.online = null;
  else if (user.friend) {
    user.friend.delete(gameId);
    if (user.friend.size === 0) {
      user.friend = null;
    }
  }
  if (!user.online && !user.friend) {
    activePlayers.delete(userId);
  }
}
function fetchGame(userId: number, gameId?: string): GameServer | null {
  const userGames = activePlayers.get(userId);
  if (!userGames) return null;
  if (!gameId) return userGames.online || null;
  if (!userGames.friend) return null;
  return userGames.friend.get(gameId) || null;
}

function stopGame(game: GameServer | null, connection: any | null): GameServer | null {
  if (
    game &&
    (!connection || Array.from(game.clients.values()).find((c) => c.connection === connection))
  ) {
    try {
      game.stop();
    } catch (err) {
      console.error("Error stopping game:", err);
    }
    if (["remote", "friend"].includes(game.gameMode)) {
      game.clients.forEach((client) => {
        removeGame(client.playerInfo.userId, game?.gameId);
      });
    }

    if (waitingRemotePlayer && waitingRemotePlayer.game === game) {
      waitingRemotePlayer = null;
    }
    game.clients.clear();
    activeGames.delete(game);
    game = null;
  }
  return game;
}

// Helper function to terminate all games for a specific user (e.g., on logout)
// Can be called from an HTTP endpoint in the future
function terminateUserGames(userId: number): void {
  const user = activePlayers.get(userId);
  if (!user) return;
  const userGames = new Set<GameServer>();
  if (user.online) userGames.add(user.online);
  if (user.friend) {
    for (const game of user.friend.values()) {
      userGames.add(game);
    }
  }

  for (const game of userGames) {
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
    stopGame(game, null);
  }
}

// WebSocket route for game
fastify.register(async function (server: FastifyInstance) {
  server.get("/game", { websocket: true }, (connection: any, req: any) => {
    console.log("Client connected");

    // Each connection is assigned a player number and game
    let game: ReturnType<typeof createGame> | null = null;
    let tournament: Tournament | null = null;
    let mode: string | null = null;
    let player: PlayerInfo | null = null;
    let gameId: string | null = null;

    connection.on("message", async (message: any) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle different message types
        switch (data.type) {
          case "playerInput": {
            if (!game) return;
            const input = data.data as { player: number; action: string };
            game.handlePlayerInput(input);
            break;
          }
          case "newGame": {
            // Validate and extract game mode and player info
            const gameStartData = data as GameStartPayload;
            const { error, gameMode, player, difficulty, gameId } =
              validateNewGameMessage(gameStartData);
            mode = gameMode!;

            if (error) {
              console.warn("Invalid newGame message:", error);
              sendErrorToClient(connection, error);
              return;
            }
            const joinGame = () => {
              if (!game) {
                game = createGame(mode!);
                game.clients.set(1, { playerInfo: player!, connection });
                activeGames.add(game);
                game.gameId = gameId;
                addGame(player!.userId, game, gameId);
                game.freezeBall();
              } else {
                game.isWaiting = false;
                game.clients.set(2, { playerInfo: player!, connection });
                addGame(player!.userId, game, gameId);
                game
                  .runGameCountdown()
                  .catch((err) => console.error("Error during online game countdown:", err));
              }
            };

            if (mode === "tournament") {
              if (!tournament || !game) return;
              if (!game.isWaiting) return;
              game.isWaiting = false;
              game
                .runGameCountdown()
                .catch((err) => console.error("Error during tournament game countdown:", err));
              break;
            }

            if (["remote", "friend"].includes(mode)) {
              game = fetchGame(player!.userId, gameId);
              if (game && game.updateConnection(player!.userId, connection)) {
                break;
              }
            }
            game = stopGame(game, connection);

            if (["local", "ai"].includes(mode)) {
              game = createGame(mode);
              if (mode === "ai") {
                game.aiPlayer.aiDifficulty = difficulty!;
              }

              game.clients.set(2, {
                playerInfo: { userId: 0, username: mode },
                connection,
              });
              activeGames.add(game);
              game.freezeBall();

              game
                .runGameCountdown()
                .catch((err) => console.error("Error during local game countdown:", err));
            } else if (mode === "remote") {
              if (!waitingRemotePlayer) {
                joinGame();
                waitingRemotePlayer = { playerInfo: player!, connection, game: game! };
              } else {
                game = waitingRemotePlayer.game;
                waitingRemotePlayer = null;
                joinGame();
              }
            } else if (mode === "friend") {
              if (!gameId) {
                const errorMsg = "Missing required field: gameId for friend mode";
                console.warn("Invalid newGame message:", errorMsg);
                sendErrorToClient(connection, errorMsg);
                return;
              }
              // Fetch invitation from backend database service
              try {
                const backendUrl = config.backendDatabase.url || process.env.BACKEND_DATABASE_URL;
                const resp = await fetch(`${backendUrl}/api/friend-invitations/${gameId}`);
                if (!resp.ok) {
                  const msg = await resp.text().catch(() => "");
                  const errorMsg = "This invitation is no longer valid.";
                  console.warn("Invalid newGame message:", errorMsg, resp.status, msg);
                  sendErrorToClient(connection, errorMsg);
                  return;
                }

                const json = await resp.json();
                const invite = json.data;
                if (!invite) {
                  const errorMsg = "This invitation is no longer valid.";
                  console.warn("Invalid newGame message:", errorMsg);
                  sendErrorToClient(connection, errorMsg);
                  return;
                }

                // Validate that the joining player is either inviter or invitee
                const userId = player!.userId;
                const invitedIds = [Number(invite.inviter_id), Number(invite.invitee_id)];
                if (!invitedIds.includes(Number(userId))) {
                  const errorMsg = "You are not authorized to join this game.";
                  console.warn("Invalid newGame message:", errorMsg);
                  sendErrorToClient(connection, errorMsg);
                  return;
                }

                for (const id of invitedIds) {
                  game = fetchGame(id, gameId);
                  if (game) break;
                }

                joinGame();
                if (!game) {
                  console.error("Failed to create or join friend game");
                  return;
                }
              } catch (err) {
                console.error("Error fetching invitation from backend:", err);
                sendErrorToClient(connection, "This invitation is no longer valid.");
                return;
              }
            }
            break;
          }
          case "newTournament": {
            // Validate and extract game mode and player info (but it will send 4 or 8 playerInfos)
            const tournamentData = data as {
              mode: string;
              players: string[];
            };
            const { error, mode, players } = validateTournamentMessage(tournamentData);

            if (error || !players) {
              const errorMsg = error || "Missing required field: players";
              console.warn("Invalid newTournament message:", errorMsg);
              sendErrorToClient(connection, errorMsg);
              return;
            }

            if (mode !== "tournament") {
              const errorMsg = "Game mode must be 'tournament' for newTournament";
              console.warn("Invalid newTournament message:", errorMsg);
              sendErrorToClient(connection, errorMsg);
              return;
            }

            if (tournament) {
              activeTournaments.delete(tournament);
              tournament = null;
            }

            tournament = new Tournament(players);
            activeTournaments.add(tournament);
            game = startNextTournamentGame(connection, tournament);
            break;
          }
          case "nextGame": {
            if (!data.mode) return;
            if (
              (data.mode == "tournament" && tournament) ||
              ["friend", "remote"].includes(data.mode)
            ) {
              game = stopGame(game, null);
              if (data.mode == "tournament") {
                game = startNextTournamentGame(connection, tournament);
                if (!game) {
                  // send tournament complete message with results
                  connection.send(
                    JSON.stringify({
                      type: "tournamentComplete",
                      gameMode: data.mode,
                      results: tournament!.getResults() || [],
                    })
                  );
                  tournament = null;
                }
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error("Error parsing message:", err);
        sendErrorToClient(connection, "Failed to parse message");
      }
    });

    connection.on("close", () => {
      console.log("Client disconnected");

      // Notify other players in the game that someone left
      if (game && ["remote", "friend"].includes(game.gameMode)) {
        let leavingClient = Array.from(game.clients.values()).find(
          (c) => c.connection === connection
        );
        if (!leavingClient) return;
        game = fetchGame(leavingClient.playerInfo.userId, game.gameId);
        if (!game) return;
        const connections = Array.from(game.clients.values()).map((c) => c.connection);
        if (!connections.includes(leavingClient.connection)) return;
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
      game = stopGame(game, connection);
    });
  });
});

function startNextTournamentGame(
  connection: any,
  tournament?: Tournament | null
): GameServer | null {
  if (!tournament) return null;
  const pair = tournament.getNextPair();
  if (!pair) {
    console.log("🏆 No more pairs - tournament complete!");
    tournament.getResults();
    //send results
    activeTournaments.delete(tournament);
    tournament = null;
    return null;
  }

  const game = createGame("tournament");
  game.tournament = tournament;
  game.clients.set(1, {
    playerInfo: { username: pair.player1.username, userId: pair.player1.userId },
    connection,
  });
  game.clients.set(2, {
    playerInfo: { username: pair.player2.username, userId: pair.player2.userId },
    connection: undefined,
  });
  activeGames.add(game);
  game.freezeBall();
  return game;
}

// Helper function to validate newGame message
function validateNewGameMessage(data: any): {
  error?: string;
  gameMode?: string;
  player?: PlayerInfo;
  difficulty?: "easy" | "medium" | "hard";
  gameId?: string;
} {
  // Check if mode is present
  if (!data.mode) {
    return { error: "Missing required field: mode" };
  }

  // Validate game mode
  const validModes = Object.values(VALID_MODES);
  if (!validModes.includes(data.mode)) {
    return {
      error: `Invalid game mode: ${data.mode}. Must be one of: ${validModes.join(", ")}`,
    };
  }

  // Validate difficulty if provided
  if (data.mode == "ai" && !["easy", "medium", "hard"].includes(data.difficulty)) {
    return {
      error: `Invalid difficulty: ${data.difficulty}. Must be one of: easy, medium, hard`,
    };
  }

  if (["remote", "friend"].includes(data.mode)) {
    if (!data.player) {
      return { error: "Missing required field: player" };
    }

    if (!data.player.username) {
      return { error: "Player must have a username" };
    }

    if (!data.player.userId) {
      return { error: "Player must have a userId" };
    }
  }
  if (data.mode === "friend" && !data.gameId) {
    return { error: "Missing required field: gameId for friend mode" };
  }

  return {
    gameMode: data.mode,
    player: data.player,
    difficulty: data.difficulty,
    gameId: data.gameId,
  };
}

function validateTournamentMessage(data: any): {
  error?: string;
  mode?: string;
  players?: string[];
} {
  // Check if mode is present
  if (!data.mode) {
    return { error: "Missing required field: mode" };
  }
  if (data.mode !== "tournament") {
    return { error: "Game mode must be 'tournament' for newTournament" };
  }

  if (!data.players) {
    return { error: "Missing or invalid required field: players" };
  }

  // Additional validation: check for unique and non-empty usernames
  const usernames = data.players.map((name: string) => name.trim());
  const uniqueUsernames = new Set(usernames);

  if (usernames.includes("")) {
    return { error: "Player usernames must be non-empty" };
  }

  if (uniqueUsernames.size !== usernames.length) {
    return { error: "Player usernames must be unique" };
  }

  //Check if there are 4 or 8 players
  if (data.players.length !== 4 && data.players.length !== 8) {
    return { error: "Tournament must have exactly 4 or 8 players" };
  }

  return {
    mode: data.mode,
    players: data.players,
  };
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
