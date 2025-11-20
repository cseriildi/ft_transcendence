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
      const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
      const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");
      await waitForMessage(ws1);

      ws2.close();

      const notification = await waitForMessage(ws1);
      expect(notification.type).toBe("user_left_chat");
      expect(notification.username).toBe("2");

      await closeWebSocket(ws1);
    });

    it("should clean up empty chat rooms", async () => {
      const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
      const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");
      await waitForMessage(ws1);

      expect(chatRooms.has("1-2")).toBe(true);

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);

      // Give some time for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(chatRooms.has("1-2")).toBe(false);
    });
  });

  describe("Multiple Chat Rooms", () => {
    it("should isolate messages between different chat rooms", async () => {
      // Room 1: 1-2
      const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
      const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");
      await waitForMessage(ws1);

      // Room 2: 1-3 (use ws3 as user 1's second connection)
      const ws3 = new WebSocket(`${serverAddress}/ws?userId=1`);
      await new Promise((resolve) => ws3.on("open", resolve));
      ws3.send(JSON.stringify({ action: "join_chat", chatid: "1-3" }));
      await waitForMessage(ws3);

      const ws4 = await connectAndJoinChat(serverAddress, "3", "1-3");
      await waitForMessage(ws3);

      // Send message in room 1
      ws1.send(
        JSON.stringify({
          action: "send_message",
          chatid: "1-2",
          message: "Message for room 1",
        })
      );

      // User 2 should receive it
      const user2Msg = await waitForMessage(ws2);
      expect(user2Msg.message).toBe("Message for room 1");

      // User 3 should not receive it
      let user3ReceivedRoom1Message = false;
      ws4.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.message === "Message for room 1") {
          user3ReceivedRoom1Message = true;
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(user3ReceivedRoom1Message).toBe(false);

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
      await closeWebSocket(ws3);
      await closeWebSocket(ws4);
    });
  });
});
