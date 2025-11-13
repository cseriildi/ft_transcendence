import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import WebSocket from "ws";
import dbConnector from "../src/database.ts";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import fs from "fs";
import http from "http";

// Helper to create a WebSocket client
function createWebSocketClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

// Helper to wait for a WebSocket message
function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Timeout waiting for message"));
    }, timeout);

    ws.once("message", (data) => {
      clearTimeout(timeoutId);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        resolve(data.toString());
      }
    });
  });
}

// Helper to close WebSocket gracefully
function closeWebSocket(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
    ws.close();
  });
}

// Helper to wait for WebSocket open and async auth to complete
function waitForAuthenticatedConnection(ws: WebSocket, timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    let opened = false;

    const timeoutId = setTimeout(() => {
      if (opened && ws.readyState === WebSocket.OPEN) {
        // Connection opened and stayed open - auth succeeded
        resolve();
      } else if (opened) {
        // Connection opened but then closed - auth failed
        reject(new Error("Connection closed after opening (auth failed)"));
      } else {
        // Never opened
        reject(new Error("Connection timeout - never opened"));
      }
    }, timeout);

    ws.once("open", () => {
      opened = true;
      // Don't resolve immediately - wait for timeout to ensure auth completes
    });

    ws.once("close", () => {
      clearTimeout(timeoutId);
      if (opened) {
        reject(new Error("Connection closed after opening (auth failed)"));
      } else {
        reject(new Error("Connection closed before opening"));
      }
    });

    ws.once("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

describe("WebSocket - Lobby Connections", () => {
  let app: FastifyInstance;
  let testDbPath: string;
  let serverAddress: string;
  let mockAuthServer: http.Server | null = null;
  let mockAuthPort: number;

  beforeEach(async () => {
    testDbPath = "./test-websocket.db";

    // Create test app with WebSocket support
    app = Fastify({ logger: false });

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

    const lobbyConnections = new Map<any, string>();
    const userLobbyConnections = new Map<string, Set<any>>();
    const banList = new Map<string, Set<{ banned: string }>>();

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

        // Track state
        const userChatRooms = new Set<string>();
        let inLobby = false;

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
                banList.get(username)!.add({ banned: row.blocked_user });
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
                if (inLobby) {
                  connection.send(JSON.stringify({ type: "error", message: "Already in lobby" }));
                  return;
                }

                lobbyConnections.set(connection, username);
                if (!userLobbyConnections.has(username)) {
                  userLobbyConnections.set(username, new Set());
                }
                userLobbyConnections.get(username)!.add(connection);
                inLobby = true;

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
                if (!inLobby) {
                  connection.send(JSON.stringify({ type: "error", message: "Not in lobby" }));
                  return;
                }

                lobbyConnections.delete(connection);
                inLobby = false;

                const userConns = userLobbyConnections.get(username);
                if (userConns) {
                  userConns.delete(connection);
                  if (userConns.size === 0) {
                    userLobbyConnections.delete(username);
                  }
                }

                const updatedUsersList = Array.from(new Set(userLobbyConnections.keys()));
                for (const [otherConn, otherUsername] of lobbyConnections) {
                  otherConn.send(
                    JSON.stringify({
                      type: "user_list_update",
                      allUsers: updatedUsersList.filter((u) => u !== otherUsername),
                    })
                  );
                }

                connection.send(JSON.stringify({ type: "lobby_left", message: "Left lobby" }));
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
          if (inLobby) {
            lobbyConnections.delete(connection);

            const userConns = userLobbyConnections.get(username);
            if (userConns) {
              userConns.delete(connection);
              if (userConns.size === 0) {
                userLobbyConnections.delete(username);
              }
            }

            const allUsersList = Array.from(new Set(userLobbyConnections.keys()));
            for (const [otherConn, otherUsername] of lobbyConnections) {
              otherConn.send(
                JSON.stringify({
                  type: "user_list_update",
                  allUsers: allUsersList.filter((u) => u !== otherUsername),
                })
              );
            }
          }
        });
      });
    });

    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (address && typeof address === "object") {
      serverAddress = `ws://127.0.0.1:${address.port}`;
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (mockAuthServer) {
      await new Promise<void>((resolve) => {
        mockAuthServer!.close(() => resolve());
      });
      mockAuthServer = null;
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("Connection Authorization", () => {
    it("should close connection without username", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?userId=1`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {}); // Ignore errors
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should close connection without userId", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?username=alice`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should close connection with missing both username and userId", async () => {
      const ws = new WebSocket(`${serverAddress}/ws`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should close connection with empty username", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?username=&userId=1`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should close connection with empty userId", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?username=alice&userId=`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should accept connection with valid credentials", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);

      // Wait for connection to open
      await new Promise((resolve) => {
        ws.on("open", resolve);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Now join lobby
      ws.send(JSON.stringify({ action: "join_lobby" }));

      const message = await waitForMessage(ws);

      expect(message.type).toBe("lobby_connected");
      expect(message.message).toContain("Welcome alice");

      await closeWebSocket(ws);
    });

    // Note: Bearer token authentication is currently disabled for testing
    // When re-enabled in production, add tests for:
    // - Missing Authorization header
    // - Invalid Bearer token format
    // - Expired or invalid token
    // - Token for non-existent user
    // - Token without required permissions
  });

  describe("Bearer Token Authentication", () => {
    // NOTE: These tests use Authorization headers, which works in Node.js with the 'ws' library.
    // However, browser WebSocket API does NOT support custom headers.
    // For browser clients, use:
    // 1. Query parameters (less secure, token visible in URL)
    // 2. Cookies (recommended, automatic with credentials: true)
    // 3. Send token in first WebSocket message after connection

    // Helper to create app with authentication enabled
    async function createAuthEnabledApp() {
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

      const lobbyConnections = new Map<any, string>();
      const userLobbyConnections = new Map<string, Set<any>>();
      const banList = new Map<string, Set<{ banned: string }>>();

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

          // Authentication enabled - check Authorization header (like production code)
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

          // Track state
          const userChatRooms = new Set<string>();
          let inLobby = false;

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
                  banList.get(username)!.add({ banned: row.blocked_user });
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
                  if (inLobby) {
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
                  inLobby = true;

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
                      const otherUsersList = Array.from(
                        new Set(userLobbyConnections.keys())
                      ).filter((u) => u !== otherUsername);
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
            if (inLobby) {
              lobbyConnections.delete(connection);

              const userConns = userLobbyConnections.get(username);
              if (userConns) {
                userConns.delete(connection);
                if (userConns.size === 0) {
                  userLobbyConnections.delete(username);
                }
              }
            }
          });
        });
      });

      return authApp;
    }

    // Helper to create mock authentication server
    function createMockAuthServer(
      validTokens: Map<string, { userId: string; username: string }>
    ): Promise<number> {
      return new Promise((resolve) => {
        mockAuthServer = http.createServer((req, res) => {
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

        mockAuthServer!.listen(0, "127.0.0.1", () => {
          const address = mockAuthServer!.address();
          if (address && typeof address === "object") {
            mockAuthPort = address.port;
            resolve(mockAuthPort);
          }
        });
      });
    }

    it("should reject connection without token", async () => {
      const validTokens = new Map([["valid-token-123", { userId: "1", username: "alice" }]]);

      await createMockAuthServer(validTokens);
      const authApp = await createAuthEnabledApp();
      await authApp.listen({ port: 0, host: "127.0.0.1" });

      const address = authApp.server.address();
      let testServerAddress = "";
      if (address && typeof address === "object") {
        testServerAddress = `ws://127.0.0.1:${address.port}`;
      }

      const ws = new WebSocket(`${testServerAddress}/ws?username=alice&userId=1`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);

      await authApp.close();
    });

    it("should reject connection with empty token", async () => {
      const validTokens = new Map([["valid-token-123", { userId: "1", username: "alice" }]]);

      await createMockAuthServer(validTokens);
      const authApp = await createAuthEnabledApp();
      await authApp.listen({ port: 0, host: "127.0.0.1" });

      const address = authApp.server.address();
      let testServerAddress = "";
      if (address && typeof address === "object") {
        testServerAddress = `ws://127.0.0.1:${address.port}`;
      }

      // Connect with empty Bearer token
      const ws = new WebSocket(`${testServerAddress}/ws?username=alice&userId=1`, {
        headers: {
          Authorization: "Bearer ",
        },
      });

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);

      await authApp.close();
    });

    it("should reject connection with invalid token", async () => {
      const validTokens = new Map([["valid-token-123", { userId: "1", username: "alice" }]]);

      await createMockAuthServer(validTokens);
      const authApp = await createAuthEnabledApp();
      await authApp.listen({ port: 0, host: "127.0.0.1" });

      const address = authApp.server.address();
      let testServerAddress = "";
      if (address && typeof address === "object") {
        testServerAddress = `ws://127.0.0.1:${address.port}`;
      }

      // Connect with invalid token
      const ws = new WebSocket(`${testServerAddress}/ws?username=alice&userId=1`, {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);

      await authApp.close();
    });

    it("should reject connection with token for different user", async () => {
      const validTokens = new Map([
        ["alice-token", { userId: "1", username: "alice" }],
        ["bob-token", { userId: "2", username: "bob" }],
      ]);

      await createMockAuthServer(validTokens);
      const authApp = await createAuthEnabledApp();
      await authApp.listen({ port: 0, host: "127.0.0.1" });

      const address = authApp.server.address();
      let testServerAddress = "";
      if (address && typeof address === "object") {
        testServerAddress = `ws://127.0.0.1:${address.port}`;
      }

      // Try to connect as alice with bob's token
      const ws = new WebSocket(`${testServerAddress}/ws?username=alice&userId=1`, {
        headers: {
          Authorization: "Bearer bob-token",
        },
      });

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);

      await authApp.close();
    });

    it("should accept connection with valid token", async () => {
      const validTokens = new Map([["valid-token-123", { userId: "1", username: "alice" }]]);

      await createMockAuthServer(validTokens);
      const authApp = await createAuthEnabledApp();
      await authApp.listen({ port: 0, host: "127.0.0.1" });

      const address = authApp.server.address();
      let testServerAddress = "";
      if (address && typeof address === "object") {
        testServerAddress = `ws://127.0.0.1:${address.port}`;
      }

      const ws = new WebSocket(`${testServerAddress}/ws?username=alice&userId=1`, {
        headers: {
          Authorization: "Bearer valid-token-123",
        },
      });

      // Wait for connection to open AND for async auth to complete
      await waitForAuthenticatedConnection(ws);

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Join lobby to verify full functionality
      ws.send(JSON.stringify({ action: "join_lobby" }));

      const message = await waitForMessage(ws);

      expect(message.type).toBe("lobby_connected");
      expect(message.message).toContain("Welcome alice");

      await closeWebSocket(ws);
      await authApp.close();
    }, 10000);

    it("should handle multiple users with different valid tokens", async () => {
      const validTokens = new Map([
        ["alice-token", { userId: "1", username: "alice" }],
        ["bob-token", { userId: "2", username: "bob" }],
      ]);

      await createMockAuthServer(validTokens);
      const authApp = await createAuthEnabledApp();
      await authApp.listen({ port: 0, host: "127.0.0.1" });

      const address = authApp.server.address();
      let testServerAddress = "";
      if (address && typeof address === "object") {
        testServerAddress = `ws://127.0.0.1:${address.port}`;
      }

      // Connect alice
      const ws1 = new WebSocket(`${testServerAddress}/ws?username=alice&userId=1`, {
        headers: {
          Authorization: "Bearer alice-token",
        },
      });

      await waitForAuthenticatedConnection(ws1);

      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      // Connect bob
      const ws2 = new WebSocket(`${testServerAddress}/ws?username=bob&userId=2`, {
        headers: {
          Authorization: "Bearer bob-token",
        },
      });

      await waitForAuthenticatedConnection(ws2);

      ws2.send(JSON.stringify({ action: "join_lobby" }));
      const bobMessage = await waitForMessage(ws2);

      expect(bobMessage.type).toBe("lobby_connected");
      expect(bobMessage.allUsers).toContain("alice");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
      await authApp.close();
    }, 10000);
  });

  describe("User List Management", () => {
    it("should send empty user list to first user", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);

      await new Promise((resolve) => ws.on("open", resolve));

      ws.send(JSON.stringify({ action: "join_lobby" }));

      const message = await waitForMessage(ws);

      expect(message.type).toBe("lobby_connected");
      expect(message.allUsers).toEqual([]);

      await closeWebSocket(ws);
    });

    it("should notify existing users when new user connects", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);

      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1); // Wait for alice to connect

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);

      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));

      // Wait for bob's connection message
      await waitForMessage(ws2);

      // Alice should receive user list update
      const aliceUpdate = await waitForMessage(ws1);
      expect(aliceUpdate.type).toBe("user_list_update");
      expect(aliceUpdate.allUsers).toContain("bob");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
    });

    it("should send correct user list to new user", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);
      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));

      const bobMessage = await waitForMessage(ws2);

      expect(bobMessage.type).toBe("lobby_connected");
      expect(bobMessage.allUsers).toContain("alice");
      expect(bobMessage.allUsers).not.toContain("bob");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
    });
  });

  describe("User Disconnect", () => {
    it("should notify other users when a user disconnects", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);
      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws2);
      await waitForMessage(ws1); // Clear alice's update

      // Bob disconnects
      ws2.close();

      // Alice should get an update
      const aliceUpdate = await waitForMessage(ws1);
      expect(aliceUpdate.type).toBe("user_list_update");
      expect(aliceUpdate.allUsers).not.toContain("bob");

      await closeWebSocket(ws1);
    });

    it("should handle multiple users disconnecting", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);
      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws2);
      await waitForMessage(ws1);

      const ws3 = new WebSocket(`${serverAddress}/ws?username=charlie&userId=3`);
      await new Promise((resolve) => ws3.on("open", resolve));
      ws3.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws3);
      await waitForMessage(ws1);
      await waitForMessage(ws2);

      ws2.close();
      await waitForMessage(ws1); // Alice gets update
      await waitForMessage(ws3); // Charlie gets update

      ws3.close();
      const finalUpdate = await waitForMessage(ws1);

      expect(finalUpdate.allUsers).not.toContain("bob");
      expect(finalUpdate.allUsers).not.toContain("charlie");

      await closeWebSocket(ws1);
    });
  });
});
