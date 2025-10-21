import type { FastifyInstance } from "fastify";
import { banList } from "../services/state.js";
import {
  handleJoinLobby,
  handleLeaveLobby,
  cleanupLobbyConnection,
} from "../handlers/lobby.handler.js";
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
    const username  = req.query as string;

    // Basic validation
    if (!username) {
      connection.close();
      return;
    }

    // Track which chat rooms this connection is in
    const userChatRooms = new Set<string>();
    // Use object wrapper to allow mutation in handlers
    const inLobby = { value: false };

    // Handle incoming messages with action-based routing
    connection.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.action) {
          case "join_lobby":
            await handleJoinLobby(connection, username, inLobby, data.token, fastify);
            break;

          case "leave_lobby":
            await handleLeaveLobby(connection, username, inLobby);
            break;

          case "join_chat":
            await handleJoinChat(
              connection,
              username,
              data.chatid,
              userChatRooms
            );
            break;

          case "leave_chat":
            await handleLeaveChat(
              connection,
              username,
              data.chatid,
              userChatRooms
            );
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
            connection.send(
              JSON.stringify({ type: "error", message: "Unknown action" })
            );
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
      cleanupLobbyConnection(connection, username, inLobby.value);
      cleanupChatConnections(connection, username, userChatRooms);
    });
  });
}
