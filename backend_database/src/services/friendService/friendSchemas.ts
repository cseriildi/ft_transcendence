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
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              user1_id: { type: "string" },
              user2_id: { type: "string" },
              action: { type: "string", enum: ["add", "accept", "decline", "remove"] },
              created_at: { type: "string" }
            }
          },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      },
      400: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Invalid request data" },
          timestamp: { type: "string" }
        }
      },
      401: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Missing or invalid access token" },
          timestamp: { type: "string" }
        }
      },
      403: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Cannot manage another user's friends" },
          timestamp: { type: "string" }
        }
      },
      404: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "User not found" },
          timestamp: { type: "string" }
        }
      }
    }
  }
};