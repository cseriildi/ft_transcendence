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
    const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
    const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");

    await waitForMessage(ws1); // Clear notification

    // User 1 sends a message
    ws1.send(
      JSON.stringify({
        action: "send_message",
        chatid: "1-2",
        message: "Hello from User 1!",
      })
    );

    // User 2 should receive it
    const received = await waitForMessage(ws2);
    expect(received.type).toBe("message");
    expect(received.username).toBe("1");
    expect(received.message).toBe("Hello from User 1!");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });

  it("should not send message back to sender", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
    const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");

    await waitForMessage(ws1);

    let user1ReceivedOwnMessage = false;
    ws1.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "message" && msg.username === "1") {
        user1ReceivedOwnMessage = true;
      }
    });

    ws1.send(JSON.stringify({ action: "send_message", chatid: "1-2", message: "Hello!" }));
    await waitForMessage(ws2); // Wait for user 2 to receive

    // Give some time to see if user 1 receives their own message
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(user1ReceivedOwnMessage).toBe(false);

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });

  it("should broadcast to multiple users in same room", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
    const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");
    await waitForMessage(ws1);

    const ws3 = await connectAndJoinChat(serverAddress, "3", "1-2");
    await waitForMessage(ws1);
    await waitForMessage(ws2);

    ws1.send(JSON.stringify({ action: "send_message", chatid: "1-2", message: "Hello everyone!" }));

    const user2Msg = await waitForMessage(ws2);
    const user3Msg = await waitForMessage(ws3);

    expect(user2Msg.message).toBe("Hello everyone!");
    expect(user3Msg.message).toBe("Hello everyone!");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
    await closeWebSocket(ws3);
  });
});
