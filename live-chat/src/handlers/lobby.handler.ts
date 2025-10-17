import type { FastifyInstance } from "fastify";
import { lobbyConnections, userLobbyConnections } from "../services/state.ts";

/**
 * Handle join_lobby action
 */
export async function handleJoinLobby(
  connection: any,
  username: string,
  inLobby: { value: boolean }
) {
  if (inLobby.value) {
    connection.send(
      JSON.stringify({ type: "error", message: "Already in lobby" })
    );
    return;
  }

  // Add to lobby
  lobbyConnections.set(connection, username);
  if (!userLobbyConnections.has(username)) {
    userLobbyConnections.set(username, new Set());
  }
  userLobbyConnections.get(username)!.add(connection);
  inLobby.value = true;

  // Send welcome message with all online users
  const allUsersList = Array.from(
    new Set(userLobbyConnections.keys())
  ).filter((u) => u !== username);

  connection.send(
    JSON.stringify({
      type: "lobby_connected",
      message: `Welcome ${username}! You are now online.`,
      allUsers: allUsersList,
    })
  );

  // Broadcast to all lobby users that someone new is online
  for (const [otherConn, otherUsername] of lobbyConnections) {
    if (otherConn !== connection) {
      const otherUsersList = Array.from(
        new Set(userLobbyConnections.keys())
      ).filter((u) => u !== otherUsername);
      otherConn.send(
        JSON.stringify({
          type: "user_list_update",
          allUsers: otherUsersList,
        })
      );
    }
  }
}

/**
 * Handle leave_lobby action
 */
export async function handleLeaveLobby(
  connection: any,
  username: string,
  inLobby: { value: boolean }
) {
  if (!inLobby.value) {
    connection.send(
      JSON.stringify({ type: "error", message: "Not in lobby" })
    );
    return;
  }

  // Remove from lobby
  lobbyConnections.delete(connection);
  inLobby.value = false;

  const userConns = userLobbyConnections.get(username);
  if (userConns) {
    userConns.delete(connection);
    if (userConns.size === 0) {
      userLobbyConnections.delete(username);
    }
  }

  // Broadcast to all lobby users
  const updatedUsersList = Array.from(
    new Set(userLobbyConnections.keys())
  );
  for (const [otherConn, otherUsername] of lobbyConnections) {
    otherConn.send(
      JSON.stringify({
        type: "user_list_update",
        allUsers: updatedUsersList.filter((u) => u !== otherUsername),
      })
    );
  }

  connection.send(
    JSON.stringify({ type: "lobby_left", message: "Left lobby" })
  );
}

/**
 * Clean up lobby connection on disconnect
 */
export function cleanupLobbyConnection(
  connection: any,
  username: string,
  inLobby: boolean
) {
  if (!inLobby) return;

  lobbyConnections.delete(connection);

  const userConns = userLobbyConnections.get(username);
  if (userConns) {
    userConns.delete(connection);
    if (userConns.size === 0) {
      userLobbyConnections.delete(username);
    }
  }

  // Broadcast to all lobby users
  const allUsersList = Array.from(new Set(userLobbyConnections.keys()));
  for (const [otherConn, otherUsername] of lobbyConnections) {
    otherConn.send(
      JSON.stringify({
        type: "user_list_update",
        allUsers: allUsersList.filter((u) => u !== otherUsername),
      })
    );
  }
}
