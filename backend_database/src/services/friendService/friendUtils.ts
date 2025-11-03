/**
 * Friend service utility functions to reduce code duplication
 */

import { errors } from "../../utils/errorUtils.ts";
import type { User } from "../../types/commonTypes.ts";
import type { DatabaseHelper } from "../../utils/databaseUtils.ts";

/**
 * Validates that two user IDs are different (can't friend yourself)
 */
export function ensureDifferentUsers(userId1: number, userId2: number) {
  if (userId1 === userId2) {
    throw errors.validation("Tokenuser ID and Param ID cannot be the same");
  }
}

/**
 * Validates that both users exist in the database
 */
export async function ensureUsersExist(
  db: DatabaseHelper,
  userId1: number,
  userId2: number
): Promise<void> {
  const user1 = await db.get<User>("SELECT id FROM users WHERE id = ?", [userId1]);
  const user2 = await db.get<User>("SELECT id FROM users WHERE id = ?", [userId2]);

  if (!user1 || !user2) {
    throw errors.notFound("One or both users not found");
  }
}

/**
 * Gets existing friend relationship between two users (if any)
 * Returns the relationship record or null
 */
export async function getFriendshipRecord(
  db: DatabaseHelper,
  userId1: number,
  userId2: number
): Promise<any | null> {
  return db.get(
    "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
    [userId1, userId2, userId2, userId1]
  );
}
