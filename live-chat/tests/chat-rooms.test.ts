import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  setupChatTestServer,
  cleanupChatTestServer,
  type ChatTestContext,
} from "./helpers/chat-test-setup.ts";
import { waitForMessage, closeWebSocket, connectAndJoinChat } from "./helpers/websocket-helpers.ts";
import { chatRooms } from "../src/services/state.ts";

describe("WebSocket - Chat Rooms Management", () => {
  let context: ChatTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupChatTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupChatTestServer(context);
  });

  describe("User Disconnect", () => {
    it("should notify others when user leaves", async () => {
      const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
      const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
      await waitForMessage(ws1);

      ws2.close();

      const notification = await waitForMessage(ws1);
      expect(notification.type).toBe("system");
      expect(notification.message).toContain("bob has left");

      await closeWebSocket(ws1);
    });

    it("should clean up empty chat rooms", async () => {
      const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
      const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
      await waitForMessage(ws1);

      expect(chatRooms.has("alice-bob")).toBe(true);

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);

      // Give some time for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(chatRooms.has("alice-bob")).toBe(false);
    });
  });

  describe("Multiple Chat Rooms", () => {
    it("should isolate messages between different chat rooms", async () => {
      // Room 1: alice-bob
      const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
      const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
      await waitForMessage(ws1);

      // Room 2: alice-charlie (use ws3 as alice's second connection)
      const ws3 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws3.on("open", resolve));
      ws3.send(JSON.stringify({ action: "join_chat", chatid: "alice-charlie" }));
      await waitForMessage(ws3);

      const ws4 = await connectAndJoinChat(serverAddress, "charlie", "3", "alice-charlie");
      await waitForMessage(ws3);

      // Send message in room 1
      ws1.send(
        JSON.stringify({
          action: "send_message",
          chatid: "alice-bob",
          message: "Message for room 1",
        })
      );

      // Bob should receive it
      const bobMsg = await waitForMessage(ws2);
      expect(bobMsg.message).toBe("Message for room 1");

      // Charlie should not receive it
      let charlieReceivedRoom1Message = false;
      ws4.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.message === "Message for room 1") {
          charlieReceivedRoom1Message = true;
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(charlieReceivedRoom1Message).toBe(false);

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
      await closeWebSocket(ws3);
      await closeWebSocket(ws4);
    });
  });
});
