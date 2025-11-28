/**
 * Game Invite Types
 *
 * Represents ephemeral game session invitations between friends.
 * Separate from friendship management - handles matchmaking coordination.
 */

// Database row representation
export interface GameInvite {
  id: number;
  inviter_id: number;
  invitee_id: number;
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
  updated_at: string;
}

// URL parameters
export interface GameInviteParams {
  id: string; // Game invite ID or friend user ID depending on endpoint
}

// Response for creating a game invite
export interface CreateGameInviteResponse {
  game_id: number;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string;
}

// Response for getting a single invite
export interface GameInviteResponse {
  game_id: number;
  inviter_id: string;
  invitee_id: string;
  inviter_username: string;
  invitee_username: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Response for listing invites
export interface GameInviteListItem {
  game_id: number;
  inviter_id: string;
  invitee_id: string;
  inviter_username: string;
  invitee_username: string;
  status: string;
  is_sender: boolean; // True if current user is the inviter
  created_at: string;
  updated_at: string;
}

export interface GameInviteListResponse {
  invites: GameInviteListItem[];
  pending_count: number;
}
