/**
 * Centralized state management for WebSocket connections
 */

// Store active connections per chat room
export const chatRooms = new Map<string, Map<any, string>>();

// Store all connected users in the lobby
export const lobbyConnections = new Map<any, string>(); // connection -> username
export const userLobbyConnections = new Map<string, Set<any>>(); // username -> lobby connections

// Ban list per user
export const banList = new Map<string, Set<{ banned: string }>>();

// Chat history
export const chatHistory = new Map<
  string,
  Array<{
    username: string;
    message: string;
    timestamp: number;
  }>
>();

// Constants
export const MAX_MESSAGES = 20;
