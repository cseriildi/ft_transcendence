import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupChatTestServer,
  cleanupChatTestServer,
  type ChatTestContext,
} from "./helpers/chat-test-setup.ts";
import { waitForMessage, closeWebSocket, connectAndJoinChat } from "./helpers/websocket-helpers.ts";

describe("WebSocket - Chat Message Broadcasting", () => {
  let context: ChatTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupChatTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupChatTestServer(context);
  });

  it("should broadcast message to other users in room", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
    const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");

    await waitForMessage(ws1); // Clear notification

    // Alice sends a message
    ws1.send(
      JSON.stringify({
        action: "send_message",
        chatid: "alice-bob",
        message: "Hello from Alice!",
      })
    );

    // Bob should receive it
    const received = await waitForMessage(ws2);
    expect(received.type).toBe("message");
    expect(received.username).toBe("alice");
    expect(received.message).toBe("Hello from Alice!");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });

  it("should not send message back to sender", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
    const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");

    await waitForMessage(ws1);

    let aliceReceivedOwnMessage = false;
    ws1.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "message" && msg.username === "alice") {
        aliceReceivedOwnMessage = true;
      }
    });

    ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Hello!" }));
    await waitForMessage(ws2); // Wait for bob to receive

    // Give some time to see if alice receives her own message
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(aliceReceivedOwnMessage).toBe(false);

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });

  it("should broadcast to multiple users in same room", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
    const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
    await waitForMessage(ws1);

    const ws3 = await connectAndJoinChat(serverAddress, "charlie", "3", "alice-bob");
    await waitForMessage(ws1);
    await waitForMessage(ws2);

    ws1.send(
      JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Hello everyone!" })
    );

    const bobMsg = await waitForMessage(ws2);
    const charlieMsg = await waitForMessage(ws3);

    expect(bobMsg.message).toBe("Hello everyone!");
    expect(charlieMsg.message).toBe("Hello everyone!");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
    await closeWebSocket(ws3);
  });
});
