import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  setupChatTestServer,
  cleanupChatTestServer,
  type ChatTestContext,
} from "./helpers/chat-test-setup.ts";
import { waitForMessage, closeWebSocket, connectAndJoinChat } from "./helpers/websocket-helpers.ts";

describe("WebSocket - Chat Room Connection", () => {
  let context: ChatTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupChatTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupChatTestServer(context);
  });

  it("should connect to a chat room with valid username", async () => {
    const ws = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");

    // The connectAndJoinChat helper already waited for chat_connected
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await closeWebSocket(ws);
  });

  it("should close connection without username", async () => {
    const ws = new WebSocket(`${serverAddress}/ws`);

    await new Promise((resolve) => {
      ws.on("close", resolve);
      ws.on("error", () => {});
    });

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it("should notify other users when someone joins", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");

    const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");

    // Alice should receive notification
    const notification = await waitForMessage(ws1);
    expect(notification.type).toBe("system");
    expect(notification.message).toContain("bob is online");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });
});
