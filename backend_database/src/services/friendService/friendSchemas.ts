import { createResponseSchema } from "../../utils/schemaUtils.ts";

export const UserSchemas = {
  // Manage friends (add, accept, decline, remove)
  manageFriends: {
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1 }
      },
      required: ["id"]
    },
    response: createResponseSchema(200, {
      type: "object" as const,
      properties: {
        user1_id: { type: "string" as const },
        user2_id: { type: "string" as const },
        action: { type: "string" as const, enum: ["add", "accept", "decline", "remove"] },
        created_at: { type: "string" as const },
        updated_at: { type: "string" as const }
      }
    }, [400, 401, 403, 404])
  }
};