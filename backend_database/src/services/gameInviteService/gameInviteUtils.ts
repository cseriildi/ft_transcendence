import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { AppError } from "../../utils/errorUtils.ts";
import { GameInvite } from "./gameInviteTypes.ts";

/**
 * Validate numeric ID format
 * Ensures ID is a positive integer
 */
export function validatePositiveId(id: string, fieldName: string): number {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Invalid ${fieldName} - must be a positive integer`
    );
  }
  return numericId;
}

/**
 * Fetch game invitation by ID
 * Returns null if not found
 */
export async function getGameInviteById(
  db: DatabaseHelper,
  gameId: number
): Promise<GameInvite | null> {
  return db.get<GameInvite>(
    "SELECT id, inviter_id, invitee_id, status, created_at, updated_at FROM friend_game_invitations WHERE id = ?",
    [gameId]
  );
}

/**
 * Ensure user is authorized to access game invitation
 * Throws 403 if user is not inviter or invitee
 */
export function ensureGameInviteAccess(
  invite: GameInvite,
  userId: number,
  action = "access"
): void {
  if (invite.inviter_id !== userId && invite.invitee_id !== userId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      `You are not authorized to ${action} this game invitation`
    );
  }
}

/**
 * Check if users are friends (accepted friendship)
 * Throws 409 if not friends
 */
export async function ensureUsersFriends(
  db: DatabaseHelper,
  user1Id: number,
  user2Id: number
): Promise<void> {
  const friendship = await db.get<{ status: string }>(
    `SELECT status FROM friends
     WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
     LIMIT 1`,
    [user1Id, user2Id, user2Id, user1Id]
  );

  if (!friendship || friendship.status !== "accepted") {
    throw new AppError(409, "CONFLICT", "Users are not friends. Cannot create game invitation.", {
      user1Id,
      user2Id,
      friendshipStatus: friendship?.status || null,
    });
  }
}

/**
 * Find existing pending game invitation between two users (bidirectional)
 * Returns the invitation if found, null otherwise
 */
export async function findPendingGameInvite(
  db: DatabaseHelper,
  user1Id: number,
  user2Id: number
): Promise<{
  id: number;
  inviter_id: number;
  invitee_id: number;
  status: string;
  created_at: string;
} | null> {
  return db.get<{
    id: number;
    inviter_id: number;
    invitee_id: number;
    status: string;
    created_at: string;
  }>(
    `SELECT id, inviter_id, invitee_id, status, created_at
     FROM friend_game_invitations
     WHERE ((inviter_id = ? AND invitee_id = ?) OR (inviter_id = ? AND invitee_id = ?))
     AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [user1Id, user2Id, user2Id, user1Id]
  );
}
