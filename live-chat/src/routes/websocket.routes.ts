import type { FastifyInstance } from "fastify";
import { banList } from "../services/state.ts";
import {
  handleJoinLobby,
  handleLeaveLobby,
  cleanupLobbyConnection,
} from "../handlers/lobby.handler.ts";
import {
  handleJoinChat,
  handleLeaveChat,
  handleSendMessage,
  cleanupChatConnections,
} from "../handlers/chat.handler.ts";

/**
 * Register WebSocket route
 */
export async function registerWebSocketRoute(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, async (connection, req) => {
    const { userId, username } = req.query as {
      userId: number;
      username: string;
    };

    // Basic validation
    if (!username || !userId) {
      connection.close();
      return;
    }

    // Authentication disabled for testing
    // In production, validate token from query params or cookies
    // const access = req.headers.authorization as string;
    // if (!access || !access.startsWith("Bearer ")) {
    //   connection.close();
    //   return;
    // }
    // const token = access.substring(7);
    // try {
    //   const upstream = await fetch(`http://localhost:3000/api/users/${userId}`, {
    //     method: "GET",
    //     headers: {
    //       authorization: `Bearer ${token}`,
    //     },
    //   });
    //   if (!upstream.ok) {
    //     connection.close();
    //     return;
    //   }
    // } catch (err) {
    //   fastify.log.error(err);
    //   connection.close();
    //   return;
    // }

    // Track which chat rooms this connection is in
    const userChatRooms = new Set<string>();
    // Use object wrapper to allow mutation in handlers
    const inLobby = { value: false };

    // Load ban list from database
    if (!banList.has(username)) {
      banList.set(username, new Set());
      const db = await fastify.db;
      db.all(
        "SELECT blocked_user FROM blocks WHERE blocker = ?",
        [username],
        (err, rows: any[]) => {
          if (err) {
            fastify.log.error(
              "Error fetching ban list for %s: %s",
              username,
              err.message
            );
            return;
          }
          for (const row of rows) {
            banList.get(username)!.add({ banned: row.blocked_user });
          }
        }
      );
    }

    // Handle incoming messages with action-based routing
    connection.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.action) {
          case "join_lobby":
            await handleJoinLobby(connection, username, inLobby);
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
