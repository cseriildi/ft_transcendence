import type { FastifyInstance } from "fastify";
import { banList } from "../services/state.js";
import {
  handleJoinChat,
  handleLeaveChat,
  handleSendMessage,
  cleanupChatConnections,
} from "../handlers/chat.handler.js";

/**
 * Register WebSocket route
 */
export async function registerWebSocketRoute(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, async (connection, req) => {
    const { userId } = req.query as { userId: string };

    // Basic validation
    if (!userId) {
      connection.close();
      return;
    }

    // Track WebSocket connection
    if (fastify.metrics?.wsConnectionsActive) {
      fastify.metrics.wsConnectionsActive.inc();
    }
    if (fastify.metrics?.wsConnectionsTotal) {
      fastify.metrics.wsConnectionsTotal.inc({ status: "connected" });
    }

    // Track which chat rooms this connection is in
    const userChatRooms = new Set<string>();

    // Handle incoming messages with action-based routing
    connection.on("message", async (message) => {
      // Track incoming message
      if (fastify.metrics?.wsMessagesTotal) {
        fastify.metrics.wsMessagesTotal.inc({ direction: "incoming", type: "chat" });
      }

      try {
        const data = JSON.parse(message.toString());

        switch (data.action) {
          case "join_chat":
            await handleJoinChat(connection, userId, data.chatid, userChatRooms, fastify);
            break;

          case "leave_chat":
            await handleLeaveChat(connection, userId, data.chatid, userChatRooms);
            break;

          case "send_message":
            await handleSendMessage(connection, userId, data.chatid, data.message, userChatRooms);
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

    // Handle connection close
    connection.on("close", () => {
      // Track WebSocket disconnection
      if (fastify.metrics?.wsConnectionsActive) {
        fastify.metrics.wsConnectionsActive.dec();
      }
      if (fastify.metrics?.wsConnectionsTotal) {
        fastify.metrics.wsConnectionsTotal.inc({ status: "disconnected" });
      }

      cleanupChatConnections(connection, userId, userChatRooms);
    });
  });
}
