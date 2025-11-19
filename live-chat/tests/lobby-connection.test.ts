import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  setupLobbyTestServer,
  cleanupLobbyTestServer,
  type LobbyTestContext,
} from "./helpers/lobby-test-setup.ts";
import { waitForMessage, closeWebSocket } from "./helpers/websocket-helpers.ts";

describe("WebSocket - Lobby Connection Authorization", () => {
  let context: LobbyTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupLobbyTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupLobbyTestServer(context);
  });

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
});
