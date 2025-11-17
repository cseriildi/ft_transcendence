import Fastify, { FastifyInstance } from "fastify";
import dbConnector from "../../src/database.ts";
import fs from "fs";
import {
  handleJoinChat,
  handleLeaveChat,
  handleSendMessage,
  cleanupChatConnections,
} from "../../src/handlers/chat.handler.ts";
import { chatRooms, chatHistory, banList } from "../../src/services/state.ts";

export interface ChatTestContext {
  app: FastifyInstance;
  serverAddress: string;
  testDbPath: string;
}

/**
 * Setup chat test server
 */
export async function setupChatTestServer(): Promise<ChatTestContext> {
  const testDbPath = "./test-chat-rooms.db";

  const app = Fastify({ logger: false });

  await app.register(import("@fastify/websocket"));
  await app.register(dbConnector, { path: testDbPath });

  // Clear shared state before each test
  chatRooms.clear();
  banList.clear();
  chatHistory.clear();

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
              await handleJoinChat(connection, username, data.chatid, userChatRooms);
              break;

            case "send_message":
              await handleSendMessage(
                connection,
                username,
                data.chatid,
                data.message,
                userChatRooms
              );
              break;

            default:
              connection.send(JSON.stringify({ type: "error", message: "Unknown action" }));
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
        cleanupChatConnections(connection, username, userChatRooms);
      });
    });
  });

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  let serverAddress = "";
  if (address && typeof address === "object") {
    serverAddress = `ws://127.0.0.1:${address.port}`;
  }

  return { app, serverAddress, testDbPath };
}

/**
 * Cleanup chat test server
 */
export async function cleanupChatTestServer(context: ChatTestContext): Promise<void> {
  if (context.app) {
    await context.app.close();
  }
  if (fs.existsSync(context.testDbPath)) {
    fs.unlinkSync(context.testDbPath);
  }
}
