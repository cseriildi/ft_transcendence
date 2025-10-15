import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import WebSocket from "ws";
import dbConnector from "./database.ts";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import fs from "fs";

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

describe("WebSocket - Lobby Connections", () => {
  let app: FastifyInstance;
  let testDbPath: string;
  let serverAddress: string;
  let mockFetchServer: any;

  beforeEach(async () => {
    testDbPath = "./test-websocket.db";
    
    // Create a mock upstream server
    mockFetchServer = Fastify({ logger: false });
    mockFetchServer.get("/api/users/:userId", async (request: any, reply: any) => {
      const auth = request.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return { id: request.params.userId, username: "testuser" };
    });
    await mockFetchServer.listen({ port: 3000, host: "127.0.0.1" });

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
      fastify.get("/lobby", { websocket: true }, async (connection, req) => {
        const username = req.query.username as string;
        const userId = req.query.userId as string;
        const access = req.headers.authorization as string;

        if (!access || !username || !userId) {
          connection.close();
          return;
        }

        const token = access.substring(7);

        // Mock authentication check
        try {
          const upstream = await fetch(`http://localhost:3000/api/users/${userId}`, {
            method: "GET",
            headers: {
              authorization: `Bearer ${token}`,
            },
          });
          if (!upstream.ok) {
            connection.close();
            return;
          }
        } catch (err) {
          fastify.log.error(err);
          connection.close();
          return;
        }

        lobbyConnections.set(connection, username);
        if (!userLobbyConnections.has(username)) {
          userLobbyConnections.set(username, new Set());
        }
        userLobbyConnections.get(username)!.add(connection);

        const allUsersList = Array.from(
          new Set(userLobbyConnections.keys())
        ).filter((u) => u !== username);

        if (!banList.has(username)) {
          banList.set(username, new Set());
          const db = await fastify.db;
          db.all(
            "SELECT blocked_user FROM blocks WHERE blocker = ?",
            [username],
            (err: any, rows: any) => {
              if (err) {
                fastify.log.error(
                  "Error fetching ban list for %s: %s",
                  username,
                  err.message
                );
                return;
              }
              for (const row of rows) {
                banList.get(username)!.add({ banned: row.blocked_user });
              }
            }
          );
        }

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

        connection.on("close", () => {
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
    if (mockFetchServer) {
      await mockFetchServer.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("Connection Authorization", () => {
    it("should close connection without authorization header", async () => {
      const ws = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`);

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {}); // Ignore errors
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should close connection without username", async () => {
      const ws = new WebSocket(`${serverAddress}/lobby?userId=1`, {
        headers: { authorization: "Bearer validtoken" },
      });

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should close connection without userId", async () => {
      const ws = new WebSocket(`${serverAddress}/lobby?username=alice`, {
        headers: { authorization: "Bearer validtoken" },
      });

      await new Promise((resolve) => {
        ws.on("close", resolve);
        ws.on("error", () => {});
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should accept connection with valid credentials", async () => {
      const ws = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`, {
        headers: { authorization: "Bearer validtoken" },
      });

      const message = await waitForMessage(ws);

      expect(message.type).toBe("lobby_connected");
      expect(message.message).toContain("Welcome alice");

      await closeWebSocket(ws);
    });
  });

  describe("User List Management", () => {
    it("should send empty user list to first user", async () => {
      const ws = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`, {
        headers: { authorization: "Bearer validtoken" },
      });

      const message = await waitForMessage(ws);

      expect(message.type).toBe("lobby_connected");
      expect(message.allUsers).toEqual([]);

      await closeWebSocket(ws);
    });

    it("should notify existing users when new user connects", async () => {
      const ws1 = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`, {
        headers: { authorization: "Bearer token1" },
      });

      await waitForMessage(ws1); // Wait for alice to connect

      const ws2 = new WebSocket(`${serverAddress}/lobby?username=bob&userId=2`, {
        headers: { authorization: "Bearer token2" },
      });

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
      const ws1 = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`, {
        headers: { authorization: "Bearer token1" },
      });
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/lobby?username=bob&userId=2`, {
        headers: { authorization: "Bearer token2" },
      });

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
      const ws1 = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`, {
        headers: { authorization: "Bearer token1" },
      });
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/lobby?username=bob&userId=2`, {
        headers: { authorization: "Bearer token2" },
      });
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
      const ws1 = new WebSocket(`${serverAddress}/lobby?username=alice&userId=1`, {
        headers: { authorization: "Bearer token1" },
      });
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/lobby?username=bob&userId=2`, {
        headers: { authorization: "Bearer token2" },
      });
      await waitForMessage(ws2);
      await waitForMessage(ws1);

      const ws3 = new WebSocket(`${serverAddress}/lobby?username=charlie&userId=3`, {
        headers: { authorization: "Bearer token3" },
      });
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
