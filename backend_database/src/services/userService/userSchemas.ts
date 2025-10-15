import { createResponseSchema, commonDataSchemas } from "../../utils/schemaUtils.ts";

export const UserSchemas = {
  // Get user by ID
  getUser: {
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1 }
      },
      required: ["id"]
    },
    response: createResponseSchema(200, commonDataSchemas.user, [401, 403, 404])
  },

  // Get all users
  getUsers: {
    response: createResponseSchema(200, commonDataSchemas.userArray, [])
  },

  // Upload avatar
  uploadAvatar: {
    response: createResponseSchema(200, {
      type: "object" as const,
      properties: {
        username: { type: "string" as const },
        avatar_url: { 
          type: "string" as const, 
          description: "Public URL to access the avatar (e.g., /uploads/avatars/abc123.png)" 
        },
        created_at: { type: "string" as const }
      }
    }, [400, 401])
  },

  changeEmail: {
    body: {
      type: "object" as const,
      properties: {
        email: { 
          type: "string", 
          format: "email",
          description: "New email address" 
        }
      },
      required: ["email"],
      additionalProperties: false
    },
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1 }
      },
      required: ["id"]
    },
    response: createResponseSchema(200, commonDataSchemas.user, [400, 401, 403, 409])
  },

  changeUsername: {
    body: {
      type: "object" as const,
      properties: {
        username: { 
          type: "string", 
          minLength: 3, 
          maxLength: 50,
          pattern: "^[a-zA-Z0-9_-]+$",
          description: "New username (3-50 characters, alphanumeric with underscores and hyphens)" 
        }
      },
      required: ["username"],
      additionalProperties: false
    },
    params: {
      type: "object" as const,
      properties: {
        id: { type: "number", minimum: 1 }
      },
      required: ["id"]
    },
    response: createResponseSchema(200, commonDataSchemas.user, [400, 401, 403, 409])
  },
};