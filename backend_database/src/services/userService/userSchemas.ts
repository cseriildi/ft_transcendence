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
      400: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Invalid email format" },
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
          message: { type: "string", description: "Cannot update another user's email" },
          timestamp: { type: "string" }
        }
      },
      409: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Email already in use" },
          timestamp: { type: "string" }
        }
      }
    }
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
      400: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Invalid username format or length" },
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
          message: { type: "string", description: "Cannot update another user's username" },
          timestamp: { type: "string" }
        }
      },
      409: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", description: "Username already in use" },
          timestamp: { type: "string" }
        }
      }
    }
  },

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