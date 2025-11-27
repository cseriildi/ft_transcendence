import { createResponseSchema } from "../../utils/schemaUtils.ts";

export const GameInviteSchemas = {
  // Create game invite to a friend
  createInvite: {
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1, description: "Friend's user ID to invite" },
      },
      required: ["id"],
    },
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          game_id: { type: "number" as const, description: "Unique game invitation ID" },
          inviter_id: { type: "string" as const },
          invitee_id: { type: "string" as const },
          status: { type: "string" as const, enum: ["pending", "accepted", "cancelled"] },
          created_at: { type: "string" as const, format: "date-time" },
        },
        required: ["game_id", "inviter_id", "invitee_id", "status", "created_at"],
      },
      [400, 401, 404, 409]
    ),
  },

  // Get single game invite by ID
  getInvite: {
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1, description: "Game invitation ID" },
      },
      required: ["id"],
    },
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          game_id: { type: "number" as const },
          inviter_id: { type: "string" as const },
          invitee_id: { type: "string" as const },
          inviter_username: { type: "string" as const },
          invitee_username: { type: "string" as const },
          status: { type: "string" as const, enum: ["pending", "accepted", "cancelled"] },
          created_at: { type: "string" as const, format: "date-time" },
          updated_at: { type: "string" as const, format: "date-time" },
        },
        required: [
          "game_id",
          "inviter_id",
          "invitee_id",
          "inviter_username",
          "invitee_username",
          "status",
          "created_at",
          "updated_at",
        ],
      },
      [401, 403, 404]
    ),
  },

  // Cancel/delete game invite
  cancelInvite: {
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1, description: "Game invitation ID" },
      },
      required: ["id"],
    },
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          game_id: { type: "number" as const },
          status: { type: "string" as const, enum: ["cancelled"] },
        },
        required: ["game_id", "status"],
      },
      [401, 403, 404]
    ),
  },

  // List all game invites for current user
  listInvites: {
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          invites: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                game_id: { type: "number" as const },
                inviter_id: { type: "string" as const },
                invitee_id: { type: "string" as const },
                inviter_username: { type: "string" as const },
                invitee_username: { type: "string" as const },
                status: { type: "string" as const, enum: ["pending", "accepted", "cancelled"] },
                is_sender: {
                  type: "boolean" as const,
                  description: "True if current user is the inviter",
                },
                created_at: { type: "string" as const, format: "date-time" },
                updated_at: { type: "string" as const, format: "date-time" },
              },
              required: [
                "game_id",
                "inviter_id",
                "invitee_id",
                "inviter_username",
                "invitee_username",
                "status",
                "is_sender",
                "created_at",
                "updated_at",
              ],
            },
          },
          pending_count: {
            type: "number" as const,
            description: "Count of pending invitations",
          },
        },
        required: ["invites", "pending_count"],
      },
      [401]
    ),
  },
};
