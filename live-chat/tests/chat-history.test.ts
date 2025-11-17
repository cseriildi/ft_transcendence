import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  setupChatTestServer,
  cleanupChatTestServer,
  type ChatTestContext,
} from "./helpers/chat-test-setup.ts";
import { waitForMessage, closeWebSocket, connectAndJoinChat } from "./helpers/websocket-helpers.ts";

describe("WebSocket - Chat History", () => {
  let context: ChatTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupChatTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupChatTestServer(context);
  });

  it("should store messages in chat history", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
    const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
    await waitForMessage(ws1);

    ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Message 1" }));
    await waitForMessage(ws2);

    ws2.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Message 2" }));
    await waitForMessage(ws1);

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);

    // Connect again and check history
    const ws3 = await connectAndJoinChat(serverAddress, "charlie", "3", "alice-bob");

    // The welcome message was already read by connectAndJoinChat,
    // but we need to get it again to check history
    // Let's reconnect properly
    await closeWebSocket(ws3);

    const ws4 = new WebSocket(`${serverAddress}/ws?username=charlie&userId=3`);
    await new Promise((resolve) => ws4.on("open", resolve));
    ws4.send(JSON.stringify({ action: "join_chat", chatid: "alice-bob" }));
    const welcome = await waitForMessage(ws4);

    expect(welcome.history).toHaveLength(2);
    expect(welcome.history[0].message).toBe("Message 1");
    expect(welcome.history[1].message).toBe("Message 2");

    await closeWebSocket(ws4);
  });

  it("should limit history to MAX_MESSAGES", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
    const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
    await waitForMessage(ws1);

    // Send 25 messages (MAX is 20)
    for (let i = 0; i < 25; i++) {
      ws1.send(
        JSON.stringify({ action: "send_message", chatid: "alice-bob", message: `Message ${i}` })
      );
      await waitForMessage(ws2);
    }

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);

    // Check history
    const ws3 = new WebSocket(`${serverAddress}/ws?username=charlie&userId=3`);
    await new Promise((resolve) => ws3.on("open", resolve));
    ws3.send(JSON.stringify({ action: "join_chat", chatid: "alice-bob" }));
    const welcome = await waitForMessage(ws3);

    expect(welcome.history).toHaveLength(20);
    // Should have the last 20 messages (5-24)
    expect(welcome.history[0].message).toBe("Message 5");
    expect(welcome.history[19].message).toBe("Message 24");

    await closeWebSocket(ws3);
  });
});
