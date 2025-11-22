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

  it("should connect to a chat room with valid userId", async () => {
    const ws = await connectAndJoinChat(serverAddress, "1", "1-2");

    // The connectAndJoinChat helper already waited for chat_connected
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await closeWebSocket(ws);
  });

  it("should close connection without userId", async () => {
    const ws = new WebSocket(`${serverAddress}/ws`);

    await new Promise((resolve) => {
      ws.on("close", resolve);
      ws.on("error", () => {});
    });

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it("should notify other users when someone joins", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");

    const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");

    // User 1 should receive notification
    const notification = await waitForMessage(ws1);
    expect(notification.type).toBe("user_joined_chat");
    expect(notification.username).toBe("2");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });
});
