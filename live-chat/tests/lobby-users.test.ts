import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import {
  setupLobbyTestServer,
  cleanupLobbyTestServer,
  type LobbyTestContext,
} from "./helpers/lobby-test-setup.ts";
import { waitForMessage, closeWebSocket } from "./helpers/websocket-helpers.ts";

describe("WebSocket - Lobby User Management", () => {
  let context: LobbyTestContext;
  let serverAddress: string;

  beforeEach(async () => {
    context = await setupLobbyTestServer();
    serverAddress = context.serverAddress;
  });

  afterEach(async () => {
    await cleanupLobbyTestServer(context);
  });

  describe("User List Management", () => {
    it("should send empty user list to first user", async () => {
      const ws = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);

      await new Promise((resolve) => ws.on("open", resolve));

      ws.send(JSON.stringify({ action: "join_lobby" }));

      const message = await waitForMessage(ws);

      expect(message.type).toBe("lobby_connected");
      expect(message.allUsers).toEqual([]);

      await closeWebSocket(ws);
    });

    it("should notify existing users when new user connects", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);

      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1); // Wait for alice to connect

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);

      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));

      // Wait for bob's connection message
      await waitForMessage(ws2);

      // Alice should receive user list update
      const aliceUpdate = await waitForMessage(ws1);
      expect(aliceUpdate.type).toBe("user_list_update");
      expect(aliceUpdate.allUsers).toContain("bob");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
    });

    it("should send correct user list to new user", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);
      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));

      const bobMessage = await waitForMessage(ws2);

      expect(bobMessage.type).toBe("lobby_connected");
      expect(bobMessage.allUsers).toContain("alice");
      expect(bobMessage.allUsers).not.toContain("bob");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
    });
  });

  describe("User Disconnect", () => {
    it("should notify other users when a user disconnects", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);
      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws2);
      await waitForMessage(ws1); // Clear alice's update

      // Bob disconnects
      ws2.close();

      // Alice should get an update
      const aliceUpdate = await waitForMessage(ws1);
      expect(aliceUpdate.type).toBe("user_list_update");
      expect(aliceUpdate.allUsers).not.toContain("bob");

      await closeWebSocket(ws1);
    });

    it("should handle multiple users disconnecting", async () => {
      const ws1 = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws1.on("open", resolve));
      ws1.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws1);

      const ws2 = new WebSocket(`${serverAddress}/ws?username=bob&userId=2`);
      await new Promise((resolve) => ws2.on("open", resolve));
      ws2.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws2);
      await waitForMessage(ws1);

      const ws3 = new WebSocket(`${serverAddress}/ws?username=charlie&userId=3`);
      await new Promise((resolve) => ws3.on("open", resolve));
      ws3.send(JSON.stringify({ action: "join_lobby" }));
      await waitForMessage(ws3);
      await waitForMessage(ws1);
      await waitForMessage(ws2);

      ws2.close();
      await waitForMessage(ws1); // Alice gets update
      await waitForMessage(ws3); // Charlie gets update

      ws3.close();
      const finalUpdate = await waitForMessage(ws1);

      expect(finalUpdate.allUsers).not.toContain("bob");
      expect(finalUpdate.allUsers).not.toContain("charlie");

      await closeWebSocket(ws1);
    });
  });
});
