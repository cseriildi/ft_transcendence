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
    // User 1 blocks user 2 (user 1 has user 2 in their ban list)
    banList.set("1", new Set(["2"]));

    const ws = new WebSocket(`${serverAddress}/ws?userId=1`);
    await new Promise((resolve) => ws.on("open", resolve));
    ws.send(JSON.stringify({ action: "join_chat", chatid: "1-2" }));

    const errorMsg = await waitForMessage(ws);
    expect(errorMsg.type).toBe("error");
    expect(errorMsg.message).toContain("block");

    // The handler doesn't close the connection, it just sends an error
    await closeWebSocket(ws);
  });

  it("should prevent blocked user from sending messages", async () => {
    const ws1 = await connectAndJoinChat(serverAddress, "1", "1-2");
    const ws2 = await connectAndJoinChat(serverAddress, "2", "1-2");
    await waitForMessage(ws1);

    // User 1 blocks User 2 (user 1 has user 2 in their ban list)
    banList.set("1", new Set(["2"]));

    ws1.send(JSON.stringify({ action: "send_message", chatid: "1-2", message: "Hello User 2!" }));

    // User 1 should receive error (they blocked user 2, so they can't send messages)
    const error = await waitForMessage(ws1);
    expect(error.type).toBe("error");
    expect(error.message).toContain("block");

    await closeWebSocket(ws1);
    await closeWebSocket(ws2);
  });
});
