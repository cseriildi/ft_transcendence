import type { FastifyInstance } from "fastify";
import {
  chatRooms,
  chatHistory,
  banList,
  MAX_MESSAGES,
  userConnections,
} from "../services/state.js";

/**
 * Handle join_chat action
 * Loads user's block list on first connection
 */
export async function handleJoinChat(
  connection: any,
  userId: string,
  chatId: string,
  userChatRooms: Set<string>,
  fastify: FastifyInstance
) {
  if (!chatId) {
    connection.send(JSON.stringify({ type: "error", message: "Missing chatid" }));
    return;
  }

  // If this is user's first chat join, add to connections and load block list
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set([connection]));

    // Load block list from database
    const db = (fastify as any).db;
    await new Promise<void>((resolve) => {
      db.all(
        "SELECT blocked_user FROM blocks WHERE blocker = ?",
        [userId],
        (err: Error, rows: any[]) => {
          if (!err && rows) {
            const blocks = new Set(rows.map((row: any) => row.blocked_user));
            banList.set(userId, blocks);
          }
          resolve();
        }
      );
    });
  } else {
    // Add this connection to existing user connections
    userConnections.get(userId)!.add(connection);
  }

  // If already in this specific chat, just resend history
  if (userChatRooms.has(chatId)) {
    const history = chatHistory.get(chatId) || [];
    connection.send(
      JSON.stringify({
        type: "chat_connected",
        message: `Reconnected to chat: ${chatId}`,
        history: history,
      })
    );
    return;
  }

  // Check if user is banned by the other user in chat
  const secondUserId = chatId.split("-").find((u: string) => u !== userId);
  if (secondUserId && banList.has(secondUserId)) {
    const bans = banList.get(secondUserId)!;
    if (bans.has(userId)) {
      connection.send(
        JSON.stringify({
          type: "error",
          message: "You are blocked by this user.",
        })
      );
      return;
    }
  }

  // Initialize chat room if needed
  if (!chatRooms.has(chatId)) {
    chatRooms.set(chatId, new Map());
  }

  const room = chatRooms.get(chatId)!;
  room.set(connection, userId);
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

  // Notify others in the chat
  for (const [client, clientUserId] of room) {
    if (client !== connection) {
      client.send(
        JSON.stringify({
          type: "user_joined_chat",
          chatid: chatId,
          username: userId,
        })
      );
    }
  }
}

/**
 * Handle leave_chat action
 */
export async function handleLeaveChat(
  connection: any,
  userId: string,
  chatId: string,
  userChatRooms: Set<string>
) {
  if (!chatId) {
    connection.send(JSON.stringify({ type: "error", message: "Missing chatid" }));
    return;
  }

  if (!userChatRooms.has(chatId)) {
    connection.send(JSON.stringify({ type: "error", message: "Not in chat" }));
    return;
  }

  const room = chatRooms.get(chatId);
  if (room) {
    room.delete(connection);

    // Notify others
    for (const [client, clientUserId] of room) {
      client.send(
        JSON.stringify({
          type: "system",
          message: `${userId} has left.`,
        })
      );
    }

    // Clean up empty rooms
    if (room.size === 0) {
      chatRooms.delete(chatId);
    }
  }

  userChatRooms.delete(chatId);

  connection.send(
    JSON.stringify({
      type: "chat_left",
      message: `Left chat: ${chatId}`,
    })
  );
}

/**
 * Handle send_message action
 */
export async function handleSendMessage(
  connection: any,
  userId: string,
  chatId: string,
  message: string,
  userChatRooms: Set<string>
) {
  if (!chatId || !message) {
    connection.send(
      JSON.stringify({
        type: "error",
        message: "Missing chatid or message",
      })
    );
    return;
  }

  if (!userChatRooms.has(chatId)) {
    connection.send(
      JSON.stringify({
        type: "error",
        message: "Not in chat room",
      })
    );
    return;
  }

  const room = chatRooms.get(chatId);
  if (!room) {
    connection.send(JSON.stringify({ type: "error", message: "Chat room not found" }));
    return;
  }

  // Check if sender is blocked
  let isBlocked = false;
  for (const [client, clientUserId] of room) {
    if (client !== connection) {
      if (banList.has(clientUserId)) {
        const bans = banList.get(clientUserId)!;
        if (Array.from(bans).some((ban) => ban === userId)) {
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
  if (!chatHistory.has(chatId)) {
    chatHistory.set(chatId, []);
  }
  const msgHistory = chatHistory.get(chatId)!;
  msgHistory.push({
    username: userId,
    message: message,
    timestamp: Date.now(),
  });
  if (msgHistory.length > MAX_MESSAGES) {
    msgHistory.shift();
  }

  // Broadcast to all in room
  for (const [client, clientUserId] of room) {
    if (client !== connection) {
      client.send(
        JSON.stringify({
          type: "message",
          chatid: chatId,
          username: userId,
          message: message,
          timestamp: Date.now(),
        })
      );
    }
  }
}

/**
 * Clean up all chat connections on disconnect
 */
export function cleanupChatConnections(
  connection: any,
  userId: string,
  userChatRooms: Set<string>
) {
  // Remove from user connections
  if (userConnections.has(userId)) {
    const connections = userConnections.get(userId)!;
    connections.delete(connection);

    // If user has no more connections, remove from tracking and clear block list
    if (connections.size === 0) {
      userConnections.delete(userId);
      banList.delete(userId);
    }
  }

  // Clean up chat rooms
  userChatRooms.forEach((chatId) => {
    const room = chatRooms.get(chatId);
    if (room) {
      room.delete(connection);

      // Notify others
      for (const [client, clientUserId] of room) {
        client.send(
          JSON.stringify({
            type: "user_left_chat",
            username: userId,
          })
        );
      }

      // Clean up empty rooms
      if (room.size === 0) {
        chatRooms.delete(chatId);
      }
    }
  });
}
