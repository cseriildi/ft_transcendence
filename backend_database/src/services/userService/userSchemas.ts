export const UserSchemas = {
  // User params validation
  userParams: {
    type: "object" as const,
    properties: {
      id: { type: "number", minimum: 1 }
    },
    required: ["id"]
  },

  // User object for responses
  userObject: {
    type: "object" as const,
    properties: {
      id: { type: "number" },
      username: { type: "string" },
      email: { type: "string" },
      created_at: { type: "string", format: "date-time" }
    }
  },

  // Get user by ID
  getUser: {
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
              id: { type: "number" },
              username: { type: "string" },
              email: { type: "string" },
              created_at: { type: "string" }
            }
          },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      },
      401: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      },
      403: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      },
      404: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      }
    }
  },

  // Get all users
  getUsers: {
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                username: { type: "string" },
                email: { type: "string" },
                created_at: { type: "string" }
              }
            }
          },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      }
    }
  },

  // Upload avatar
  uploadAvatar: {
    response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  username: { type: "string" },
                  avatar_url: { type: "string", description: "Public URL to access the avatar (e.g., /uploads/avatars/abc123.png)" },
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
              message: { type: "string" },
              timestamp: { type: "string" }
            }
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              timestamp: { type: "string" }
            }
          }
        }
  }
};