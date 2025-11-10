export const monitoringSchemas = {
  // GET /health
  health: {
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              message: { type: "string" },
              status: { type: "string" },
              database: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
            },
          },
          message: { type: "string" },
          timestamp: { type: "string" },
        },
      },
      503: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: { type: "string" },
          message: { type: "string" },
          timestamp: { type: "string" },
        },
      },
    },
  },
};
