/**
 * Centralized state management for WebSocket connections
 */

// Store active connections per chat room
// chatid -> Map<connection, userId>
export const chatRooms = new Map<string, Map<any, string>>();

// Store all user connections (for tracking first-time joins)
// userId -> Set<connections>
export const userConnections = new Map<string, Set<any>>();

// Ban list per user
// userId -> Set<blockedUserId>
export const banList = new Map<string, Set<string>>();

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
