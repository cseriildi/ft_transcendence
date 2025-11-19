import Fastify, { FastifyInstance } from "fastify";
import dbConnector from "../../src/database.ts";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import fs from "fs";
import http from "http";
import {
  handleJoinLobby,
  handleLeaveLobby,
  cleanupLobbyConnection,
} from "../../src/handlers/lobby.handler.ts";
import { lobbyConnections, userLobbyConnections, banList } from "../../src/services/state.ts";
import type {} from "../../src/types.d.ts"; // Import types for FastifyInstance.db

export interface LobbyTestContext {
  app: FastifyInstance;
  serverAddress: string;
  testDbPath: string;
  mockAuthServer: http.Server | null;
  mockAuthPort: number;
}

/**
 * Setup lobby test server (without authentication)
 */
export async function setupLobbyTestServer(): Promise<LobbyTestContext> {
  const testDbPath = "./test-websocket.db";

  const app = Fastify({ logger: false });

  await app.register(import("@fastify/websocket"));
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(helmet, { global: true });
  await app.register(dbConnector, { path: testDbPath });

  await app.register(cors, {
    origin: "http://localhost:4200",
    credentials: true,
  });

  // Clear shared state before each test
  lobbyConnections.clear();
  userLobbyConnections.clear();
  banList.clear();

  await app.register(async (fastify) => {
    fastify.get("/ws", { websocket: true }, async (connection, req) => {
      const { username, userId } = req.query as {
        username: string;
        userId: string;
      };

      if (!username || !userId) {
        connection.close();
        return;
      }

      // Use object wrapper to allow mutation in handlers
      const inLobby = { value: false };

      // Load ban list from database
      if (!banList.has(username)) {
        banList.set(username, new Set());
        const db = await fastify.db;
        db.all(
          "SELECT blocked_user FROM blocks WHERE blocker = ?",
          [username],
          (err: any, rows: any) => {
            if (err) {
              fastify.log.error("Error fetching ban list for %s: %s", username, err.message);
              return;
            }
            for (const row of rows) {
              banList.get(username)!.add(row.blocked_user);
            }
          }
        );
      }

      // Handle incoming messages
      connection.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());

          switch (data.action) {
            case "join_lobby":
              // Simplified join_lobby without auth for testing
              if (inLobby.value) {
                connection.send(JSON.stringify({ type: "error", message: "Already in lobby" }));
                return;
              }

              lobbyConnections.set(connection, username);
              if (!userLobbyConnections.has(username)) {
                userLobbyConnections.set(username, new Set());
              }
              userLobbyConnections.get(username)!.add(connection);
              inLobby.value = true;

              const allUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(
                (u) => u !== username
              );

              connection.send(
                JSON.stringify({
                  type: "lobby_connected",
                  message: `Welcome ${username}! You are now online.`,
                  allUsers: allUsersList,
                })
              );

              // Broadcast to all lobby users
              for (const [otherConn, otherUsername] of lobbyConnections) {
                if (otherConn !== connection) {
                  const otherUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(
                    (u) => u !== otherUsername
                  );
                  otherConn.send(
                    JSON.stringify({
                      type: "user_list_update",
                      allUsers: otherUsersList,
                    })
                  );
                }
              }
              break;

            case "leave_lobby":
              await handleLeaveLobby(connection, username, inLobby);
              break;

            default:
              connection.send(JSON.stringify({ type: "error", message: "Unknown action" }));
          }
        } catch (error) {
          connection.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
            })
          );
        }
      });

      connection.on("close", () => {
        cleanupLobbyConnection(connection, username, inLobby.value);
      });
    });
  });

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  let serverAddress = "";
  if (address && typeof address === "object") {
    serverAddress = `ws://127.0.0.1:${address.port}`;
  }

  return {
    app,
    serverAddress,
    testDbPath,
    mockAuthServer: null,
    mockAuthPort: 0,
  };
}

/**
 * Create app with authentication enabled
 */
export async function createAuthEnabledApp(
  testDbPath: string,
  mockAuthPort: number
): Promise<FastifyInstance> {
  const authApp = Fastify({ logger: false });

  await authApp.register(import("@fastify/websocket"));
  await authApp.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await authApp.register(helmet, { global: true });
  await authApp.register(dbConnector, { path: testDbPath });

  await authApp.register(cors, {
    origin: "http://localhost:4200",
    credentials: true,
  });

  // Clear shared state for auth tests
  lobbyConnections.clear();
  userLobbyConnections.clear();
  banList.clear();

  await authApp.register(async (fastify) => {
    fastify.get("/ws", { websocket: true }, async (connection, req) => {
      const { username, userId } = req.query as {
        username: string;
        userId: string;
      };

      // Basic validation
      if (!username || !userId) {
        connection.close();
        return;
      }

      // Authentication enabled - check Authorization header
      const access = req.headers.authorization as string;
      if (!access || !access.startsWith("Bearer ")) {
        connection.close();
        return;
      }

      const token = access.substring(7);

      // Validate token against mock auth server
      try {
        const response = await fetch(`http://localhost:${mockAuthPort}/api/users/${userId}`, {
          method: "GET",
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          connection.close();
          return;
        }
      } catch (err) {
        fastify.log.error("Auth error: %s", String(err));
        connection.close();
        return;
      }

      // Use object wrapper to allow mutation in handlers
      const inLobby = { value: false };

      // Load ban list from database
      if (!banList.has(username)) {
        banList.set(username, new Set());
        const db = await fastify.db;
        db.all(
          "SELECT blocked_user FROM blocks WHERE blocker = ?",
          [username],
          (err: any, rows: any) => {
            if (err) {
              fastify.log.error("Error fetching ban list for %s: %s", username, err.message);
              return;
            }
            for (const row of rows) {
              banList.get(username)!.add(row.blocked_user);
            }
          }
        );
      }

      // Handle incoming messages
      connection.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());

          switch (data.action) {
            case "join_lobby":
              // Basic join_lobby for auth-validated connections
              if (inLobby.value) {
                connection.send(
                  JSON.stringify({
                    type: "error",
                    message: "Already in lobby",
                  })
                );
                return;
              }

              lobbyConnections.set(connection, username);
              if (!userLobbyConnections.has(username)) {
                userLobbyConnections.set(username, new Set());
              }
              userLobbyConnections.get(username)!.add(connection);
              inLobby.value = true;

              const allUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(
                (u) => u !== username
              );

              connection.send(
                JSON.stringify({
                  type: "lobby_connected",
                  message: `Welcome ${username}! You are now online.`,
                  allUsers: allUsersList,
                })
              );

              // Broadcast to all lobby users
              for (const [otherConn, otherUsername] of lobbyConnections) {
                if (otherConn !== connection) {
                  const otherUsersList = Array.from(new Set(userLobbyConnections.keys())).filter(
                    (u) => u !== otherUsername
                  );
                  otherConn.send(
                    JSON.stringify({
                      type: "user_list_update",
                      allUsers: otherUsersList,
                    })
                  );
                }
              }
              break;
          }
        } catch (error) {
          connection.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
            })
          );
        }
      });

      connection.on("close", () => {
        cleanupLobbyConnection(connection, username, inLobby.value);
      });
    });
  });

  return authApp;
}

/**
 * Create mock authentication server
 */
export function createMockAuthServer(
  validTokens: Map<string, { userId: string; username: string }>
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const mockAuthServer = http.createServer((req, res) => {
      const authHeader = req.headers.authorization;

      // Check for Bearer token
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const token = authHeader.substring(7);
      const userMatch = req.url?.match(/\/api\/users\/(\d+)/);

      if (!userMatch) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      const userId = userMatch[1];
      const validUser = validTokens.get(token);

      if (validUser && validUser.userId === userId) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: validUser.userId,
            username: validUser.username,
          })
        );
      } else {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
      }
    });

    mockAuthServer.listen(0, "127.0.0.1", () => {
      const address = mockAuthServer.address();
      if (address && typeof address === "object") {
        resolve({ server: mockAuthServer, port: address.port });
      }
    });
  });
}

/**
 * Cleanup lobby test server
 */
export async function cleanupLobbyTestServer(context: LobbyTestContext): Promise<void> {
  if (context.app) {
    await context.app.close();
  }
  if (context.mockAuthServer) {
    await new Promise<void>((resolve) => {
      context.mockAuthServer!.close(() => resolve());
    });
  }
  if (fs.existsSync(context.testDbPath)) {
    fs.unlinkSync(context.testDbPath);
  }
}
