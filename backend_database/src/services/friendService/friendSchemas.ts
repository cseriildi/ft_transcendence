import { createResponseSchema } from "../../utils/schemaUtils.ts";

export const UserSchemas = {
  // Manage friends (add, accept, decline, remove)
  manageFriends: {
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1 },
      },
      required: ["id"],
    },
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          user1_id: { type: "string" as const },
          user2_id: { type: "string" as const },
          action: { type: "string" as const, enum: ["add", "accept", "decline", "remove"] },
          created_at: { type: "string" as const },
          updated_at: { type: "string" as const },
        },
      },
      [400, 401, 403, 404]
    ),
  },

  // Get friends' online status and all friend requests
  getFriendsStatus: {
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          friends: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                user_id: { type: "number" as const },
                username: { type: "string" as const },
                is_online: {
                  type: "boolean" as const,
                  description: "True if user was active within the online threshold window",
                },
                last_seen: {
                  type: ["string", "null"] as const,
                  format: "date-time",
                  description:
                    "ISO 8601 timestamp of user's last activity, or null if never active",
                },
                status: {
                  type: "string" as const,
                  enum: ["pending", "accepted", "declined"],
                  description: "Current status of the friendship/friend request",
                },
                inviter_id: {
                  type: "number" as const,
                  description: "User ID of who sent the friend request",
                },
                inviter_username: {
                  type: "string" as const,
                  description: "Username of who sent the friend request",
                },
                is_inviter: {
                  type: "boolean" as const,
                  description: "True if the current user sent this friend request",
                },
                created_at: {
                  type: "string" as const,
                  format: "date-time",
                  description: "When the friend request was created",
                },
                updated_at: {
                  type: "string" as const,
                  format: "date-time",
                  description: "When the friendship status was last updated",
                },
              },
              required: [
                "user_id",
                "username",
                "is_online",
                "last_seen",
                "status",
                "inviter_id",
                "inviter_username",
                "is_inviter",
                "created_at",
                "updated_at",
              ],
            },
          },
          online_threshold_minutes: {
            type: "number" as const,
            description: "Minutes within which a user is considered online",
          },
        },
      },
      [401]
    ),
  },
};
