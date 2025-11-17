import { errors } from "../../utils/errorUtils.ts";
import { DatabaseHelper } from "../../utils/databaseUtils.ts";

/**
 * Retrieves the avatar URL for a given user.
 *
 * @param db - DatabaseHelper instance
 * @param userId - User ID to fetch avatar for
 * @returns Avatar file URL
 * @throws NotFoundError if user has no avatar
 *
 * @concept Domain Logic Separation
 * This is avatar-specific business logic that doesn't belong in generic DatabaseHelper.
 * DatabaseHelper should only have low-level query methods (get, run, all, transaction).
 * Domain logic like "construct avatar URL for user" belongs in service-specific utilities.
 */
export async function getAvatarUrl(db: DatabaseHelper, userId: number): Promise<string> {
  const avatar = await db.get<{ file_url: string }>(
    "SELECT file_url FROM avatars WHERE user_id = ?",
    [userId]
  );

  if (!avatar || !avatar.file_url) {
    throw errors.notFound("Avatar", {
      userId,
      function: "getAvatarUrl",
    });
  }

  return avatar.file_url;
}
