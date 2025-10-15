import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import WebSocket from "ws";
import dbConnector from "../src/database.ts";
import fs from "fs";

// Helper to wait for a WebSocket message
function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Timeout waiting for message"));
    }, timeout);

    ws.once("message", (data) => {
      clearTimeout(timeoutId);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        resolve(data.toString());
      }
    });
  });
}

// Helper to close WebSocket gracefully
function closeWebSocket(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
    ws.close();
  });
}

// Helper to connect and join a chat
async function connectAndJoinChat(serverAddress: string, username: string, userId: string, chatId: string): Promise<WebSocket> {
  const ws = new WebSocket(`${serverAddress}/ws?username=${username}&userId=${userId}`);
  
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  
  // Send join_chat action
  ws.send(JSON.stringify({ action: "join_chat", chatid: chatId }));
  
  // Wait for chat_connected message
  await waitForMessage(ws);
  
  return ws;
}

describe("WebSocket - Chat Rooms", () => {
  let app: FastifyInstance;
  let testDbPath: string;
  let serverAddress: string;

  beforeEach(async () => {
    testDbPath = "./test-chat-rooms.db";

    app = Fastify({ logger: false });

    await app.register(import("@fastify/websocket"));
    await app.register(dbConnector, { path: testDbPath });

    const chatRooms = new Map<string, Map<any, string>>();
    const banList = new Map<string, Set<{ banned: string }>>();
    const chatHistory = new Map<
      string,
      Array<{
        username: string;
        message: string;
        timestamp: number;
      }>
    >();

    const MAX_MESSAGES = 20;

    await app.register(async (fastify) => {
      fastify.get("/ws", { websocket: true }, async (connection, req) => {
        const { username, userId } = req.query as {
          username: string;
          userId: string;
        };

        if (!username || !userId) {
          connection.close();
          return;
        }

        const userChatRooms = new Set<string>();

        connection.on("message", async (message) => {
          try {
            const data = JSON.parse(message.toString());

            switch (data.action) {
              case "join_chat":
                const chatId = data.chatid;
                if (!chatId) {
                  connection.send(
                    JSON.stringify({ type: "error", message: "Missing chatid" })
                  );
                  return;
                }

                // Check if user is banned
                const secondUser = chatId.split("-").find((u: string) => u !== username)!;
                if (banList.has(secondUser)) {
                  const bans = banList.get(secondUser)!;
                  for (const ban of bans) {
                    if (ban.banned === username) {
                      connection.send(
                        JSON.stringify({
                          type: "error",
                          message: "You are blocked by this user.",
                        })
                      );
                      connection.close();
                      return;
                    }
                  }
                }

                // Initialize chat room
                if (!chatRooms.has(chatId)) {
                  chatRooms.set(chatId, new Map());
                }

                const room = chatRooms.get(chatId)!;
                room.set(connection, username);
                userChatRooms.add(chatId);

                // Get history
                const history = chatHistory.get(chatId) || [];

                // Send welcome with history
                connection.send(
                  JSON.stringify({
                    type: "chat_connected",
                    message: `Connected to chat: ${chatId}`,
                    history: history,
                  })
                );

                // Notify others
                for (const [client, clientUsername] of room) {
                  if (client !== connection) {
                    client.send(
                      JSON.stringify({
                        type: "system",
                        message: `${username} is online.`,
                      })
                    );
                  }
                }
                break;

              case "send_message":
                const msgChatId = data.chatid;
                const msgContent = data.message;

                if (!msgChatId || !msgContent) {
                  connection.send(
                    JSON.stringify({
                      type: "error",
                      message: "Missing chatid or message",
                    })
                  );
                  return;
                }

                if (!userChatRooms.has(msgChatId)) {
                  connection.send(
                    JSON.stringify({
                      type: "error",
                      message: "Not in chat room",
                    })
                  );
                  return;
                }

                const msgRoom = chatRooms.get(msgChatId);
                if (!msgRoom) {
                  connection.send(
                    JSON.stringify({ type: "error", message: "Chat room not found" })
                  );
                  return;
                }

                // Check if sender is blocked
                let isBlocked = false;
                for (const [client, clientUsername] of msgRoom) {
                  if (client !== connection) {
                    if (banList.has(clientUsername)) {
                      const bans = banList.get(clientUsername)!;
                      if (Array.from(bans).some((ban) => ban.banned === username)) {
                        isBlocked = true;
                        break;
                      }
                    }
                  }
                }

                if (isBlocked) {
                  connection.send(
                    JSON.stringify({
                      type: "error",
                      message: "You are blocked by this user and cannot send messages.",
                    })
                  );
                  return;
                }

                // Save to history
                if (!chatHistory.has(msgChatId)) {
                  chatHistory.set(msgChatId, []);
                }
                const msgHistory = chatHistory.get(msgChatId)!;
                msgHistory.push({
                  username,
                  message: msgContent,
                  timestamp: Date.now(),
                });
                if (msgHistory.length > MAX_MESSAGES) {
                  msgHistory.shift();
                }

                // Broadcast to all in room
                for (const [client, clientUsername] of msgRoom) {
                  if (client !== connection) {
                    client.send(
                      JSON.stringify({
                        type: "message",
                        chatid: msgChatId,
                        username: username,
                        message: msgContent,
                        timestamp: Date.now(),
                      })
                    );
                  }
                }
                break;
            }
          } catch (error) {
            connection.send(
              JSON.stringify({
                type: "error",
                message: "Invalid message format",
              })
            );
          }
        });

        connection.on("close", () => {
          userChatRooms.forEach((chatId) => {
            const room = chatRooms.get(chatId);
            if (room) {
              room.delete(connection);

              // Notify others
              for (const [client, clientUsername] of room) {
                client.send(
                  JSON.stringify({
                    type: "system",
                    message: `${username} has left.`,
                  })
                );
              }

              // Clean up empty rooms
              if (room.size === 0) {
                chatRooms.delete(chatId);
              }
            }
          });
        });
      });
    });

    // Expose banList for testing
    (app as any).banList = banList;
    (app as any).chatHistory = chatHistory;
    (app as any).chatRooms = chatRooms;

    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (address && typeof address === "object") {
      serverAddress = `ws://127.0.0.1:${address.port}`;
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("Chat Room Connection", () => {
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

  describe("Message Broadcasting", () => {
    it("should broadcast message to other users in room", async () => {
      const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
      const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
      
      await waitForMessage(ws1); // Clear notification

      // Alice sends a message
      ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Hello from Alice!" }));

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

      ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Hello everyone!" }));

      const bobMsg = await waitForMessage(ws2);
      const charlieMsg = await waitForMessage(ws3);

      expect(bobMsg.message).toBe("Hello everyone!");
      expect(charlieMsg.message).toBe("Hello everyone!");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
      await closeWebSocket(ws3);
    });
  });

  describe("Chat History", () => {
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
        ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: `Message ${i}` }));
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

  describe("User Blocking", () => {
    it("should prevent blocked user from joining chat", async () => {
      // Add alice to ban list for bob
      const banList = (app as any).banList;
      banList.set("bob", new Set([{ banned: "alice" }]));

      const ws = new WebSocket(`${serverAddress}/ws?username=alice&userId=1`);
      await new Promise((resolve) => ws.on("open", resolve));
      ws.send(JSON.stringify({ action: "join_chat", chatid: "alice-bob" }));

      const errorMsg = await waitForMessage(ws);
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.message).toContain("blocked");

      await new Promise((resolve) => {
        ws.on("close", resolve);
      });

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it("should prevent blocked user from sending messages", async () => {
      const ws1 = await connectAndJoinChat(serverAddress, "alice", "1", "alice-bob");
      const ws2 = await connectAndJoinChat(serverAddress, "bob", "2", "alice-bob");
      await waitForMessage(ws1);

      // Bob blocks Alice
      const banList = (app as any).banList;
      banList.set("bob", new Set([{ banned: "alice" }]));

      ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Hello Bob!" }));

      // Alice should receive error
      const error = await waitForMessage(ws1);
      expect(error.type).toBe("error");
      expect(error.message).toContain("blocked");

      await closeWebSocket(ws1);
      await closeWebSocket(ws2);
    });
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

      const chatRooms = (app as any).chatRooms;
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
      ws1.send(JSON.stringify({ action: "send_message", chatid: "alice-bob", message: "Message for room 1" }));

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
