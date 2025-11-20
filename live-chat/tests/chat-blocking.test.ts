import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  setupChatTestServer,
  cleanupChatTestServer,
  type ChatTestContext,
} from "./helpers/chat-test-setup.ts";
import { waitForMessage, closeWebSocket, connectAndJoinChat } from "./helpers/websocket-helpers.ts";
import { banList } from "../src/services/state.ts";

describe("WebSocket - Chat User Blocking", () => {
  let context: ChatTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupChatTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupChatTestServer(context);
  });

  it("should prevent blocked user from joining chat", async () => {
    // Add user 1 to ban list for user 2
    banList.set("2", new Set(["1"]));

    const ws = new WebSocket(`${serverAddress}/ws?userId=1`);
    await new Promise((resolve) => ws.on("open", resolve));
    ws.send(JSON.stringify({ action: "join_chat", chatid: "1-2" }));

    const errorMsg = await waitForMessage(ws);
    expect(errorMsg.type).toBe("error");
    expect(errorMsg.message).toContain("blocked");

    // The handler doesn't close the connection, it just sends an error
    await closeWebSocket(ws);
  });

  it("should prevent blocked user from sending messages", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
    const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");
    await waitForMessage(ws1);

    // User 2 blocks User 1
    banList.set("2", new Set(["1"]));

    ws1.send(JSON.stringify({ action: "send_message", chatid: "1-2", message: "Hello User 2!" }));

    // User 1 should receive error
    const error = await waitForMessage(ws1);
    expect(error.type).toBe("error");
    expect(error.message).toContain("blocked");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });
});
