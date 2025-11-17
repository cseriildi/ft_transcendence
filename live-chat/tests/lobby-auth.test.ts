import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  createAuthEnabledApp,
  createMockAuthServer,
  type LobbyTestContext,
} from "./helpers/lobby-test-setup.ts";
import {
  waitForMessage,
  closeWebSocket,
  waitForAuthenticatedConnection,
} from "./helpers/websocket-helpers.ts";
import http from "http";
import fs from "fs";

describe("WebSocket - Lobby Bearer Token Authentication", () => {
  let testDbPath: string;
  let mockAuthServer: http.Server | null = null;
  let mockAuthPort: number;

  beforeEach(async () => {
    testDbPath = "./test-websocket-auth.db";
  });

  afterEach(async () => {
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

  it("should reject connection without token", async () => {
    const validTokens = new Map([["valid-token-123", { userId: "1", username: "alice" }]]);

    const authResult = await createMockAuthServer(validTokens);
    mockAuthServer = authResult.server;
    mockAuthPort = authResult.port;

    const authApp = await createAuthEnabledApp(testDbPath, mockAuthPort);
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

    const authResult = await createMockAuthServer(validTokens);
    mockAuthServer = authResult.server;
    mockAuthPort = authResult.port;

    const authApp = await createAuthEnabledApp(testDbPath, mockAuthPort);
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

    const authResult = await createMockAuthServer(validTokens);
    mockAuthServer = authResult.server;
    mockAuthPort = authResult.port;

    const authApp = await createAuthEnabledApp(testDbPath, mockAuthPort);
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

    const authResult = await createMockAuthServer(validTokens);
    mockAuthServer = authResult.server;
    mockAuthPort = authResult.port;

    const authApp = await createAuthEnabledApp(testDbPath, mockAuthPort);
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

    const authResult = await createMockAuthServer(validTokens);
    mockAuthServer = authResult.server;
    mockAuthPort = authResult.port;

    const authApp = await createAuthEnabledApp(testDbPath, mockAuthPort);
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

    const authResult = await createMockAuthServer(validTokens);
    mockAuthServer = authResult.server;
    mockAuthPort = authResult.port;

    const authApp = await createAuthEnabledApp(testDbPath, mockAuthPort);
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
