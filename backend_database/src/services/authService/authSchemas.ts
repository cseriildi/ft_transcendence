export const AuthSchemas = {
  // POST /auth/register
  register: {
    body: {
      type: "object" as const,
      properties: {
        username: { type: "string", minLength: 3, maxLength: 15 },
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8, maxLength: 20 },
        confirmPassword: { type: "string", minLength: 8 },
        avatar_url: { type: "string", description: "Optional avatar URL (if not uploading file)" }
      },
      required: ["username", "email", "password", "confirmPassword"],
      additionalProperties: false
    },
    response: {
      201: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "number" },
              username: { type: "string" },
              email: { type: "string" },
              avatar_url: { type: "string" },
              created_at: { type: "string" },
              tokens: {
                type: "object",
                properties: {
                  accessToken: { type: "string" }
                }
              }
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
      409: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          timestamp: { type: "string" }
        }
      }
    }
  },

  // POST /auth/login
  login: {
    body: {
      type: "object" as const,
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 }
      },
      required: ["email", "password"],
      additionalProperties: false
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
              created_at: { type: "string" },
              tokens: {
                type: "object",
                properties: {
                  accessToken: { type: "string" }
                }
              }
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
      }
    }
  },

// POST /auth/refresh
  refresh: {
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
              created_at: { type: "string" },
              tokens: {
                type: "object",
                properties: {
                  accessToken: { type: "string" }
                }
              }
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
      }
    }
  },

  // POST /auth/logout
  logout: {
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              message: { type: "string" }
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
      }
    }
  },

  // GET /auth/verify
  verify: {
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              verified: { type: "boolean" }
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
      404: {
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

