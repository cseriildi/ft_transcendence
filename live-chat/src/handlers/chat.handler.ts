import type { FastifyInstance } from "fastify";
import { chatRooms, chatHistory, banList, MAX_MESSAGES } from "../services/state.js";

/**
 * Handle join_chat action
 */
export async function handleJoinChat(
  connection: any,
  username: string,
  chatId: string,
  userChatRooms: Set<string>
) {
  if (!chatId) {
    connection.send(JSON.stringify({ type: "error", message: "Missing chatid" }));
    return;
  }

  // If already in chat, just resend history (allow rejoining)
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

  // Check if user is banned
  const secondUser = chatId.split("-").find((u: string) => u !== username)!;
  if (banList.has(secondUser)) {
    const bans = banList.get(secondUser)!;
    for (const ban of bans) {
      if (ban === username) {
        connection.send(
          JSON.stringify({
            type: "error",
            message: "You are blocked by this user.",
          })
        );
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
}

/**
 * Handle leave_chat action
 */
export async function handleLeaveChat(
  connection: any,
  username: string,
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
  username: string,
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
  for (const [client, clientUsername] of room) {
    if (client !== connection) {
      if (banList.has(clientUsername)) {
        const bans = banList.get(clientUsername)!;
        if (Array.from(bans).some((ban) => ban === username)) {
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
    username,
    message: message,
    timestamp: Date.now(),
  });
  if (msgHistory.length > MAX_MESSAGES) {
    msgHistory.shift();
  }

  // Broadcast to all in room
  for (const [client, clientUsername] of room) {
    if (client !== connection) {
      client.send(
        JSON.stringify({
          type: "message",
          chatid: chatId,
          username: username,
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
  username: string,
  userChatRooms: Set<string>
) {
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
}
