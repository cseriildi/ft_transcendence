import { errors } from "../../utils/errorUtils.ts";
import type { User } from "../../types/commonTypes.ts";
import type { DatabaseHelper } from "../../utils/databaseUtils.ts";

export function ensureDifferentUsers(userId1: number, userId2: number) {
  if (userId1 === userId2) {
    throw errors.validation("Tokenuser ID and Param ID cannot be the same", {
      userId: userId1,
      function: "ensureDifferentUsers",
    });
  }
}

export async function ensureUsersExist(
  db: DatabaseHelper,
  userId1: number,
  userId2: number
): Promise<void> {
  const user1 = await db.get<User>("SELECT id FROM users WHERE id = ?", [userId1]);
  const user2 = await db.get<User>("SELECT id FROM users WHERE id = ?", [userId2]);

  if (!user1 || !user2) {
    throw errors.notFound("User(s)", {
      userId1,
      userId2,
      user1Exists: !!user1,
      user2Exists: !!user2,
      function: "ensureUsersExist",
    });
  }
}

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
