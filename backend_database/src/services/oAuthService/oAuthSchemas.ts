export const OAuthSchemas = {
    callback:{
    querystring: {
          type: "object",
          properties: {
            code: { type: "string", description: "Authorization code from GitHub" },
            state: { type: "string", description: "CSRF protection state" }
          },
          required: ["code", "state"]
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
                      accessToken: { type: "string" },
                      refreshToken: { type: "string" }
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

    initiate: {
        response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                redirectUrl: { type: "string", format: "uri" }
              }
            },
            message: { type: "string" },
            timestamp: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            timestamp: { type: "string" }
          }
        }
      }
    }
}