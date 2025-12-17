
// Common error response schema (used for 400, 401, 403, 404, 409, 500, etc.)
export const errorResponseSchema = {
  type: "object" as const,
  properties: {
    success: { type: "boolean" as const },
    message: { type: "string" as const },
    timestamp: { type: "string" as const },
  },
};

export function createSuccessSchema(dataSchema: Record<string, any>) {
  return {
    type: "object" as const,
    properties: {
      success: { type: "boolean" as const },
      data: dataSchema,
      message: { type: "string" as const },
      timestamp: { type: "string" as const },
    },
  };
}

export function createResponseSchema(
  statusCode: number,
  dataSchema: Record<string, any>,
  errorCodes: number[] = []
) {
  const response: Record<number, any> = {
    [statusCode]: createSuccessSchema(dataSchema),
  };

  // Add error response schemas
  errorCodes.forEach((code) => {
    response[code] = errorResponseSchema;
  });

  return response;
}

export const commonDataSchemas = {
  // User object
  user: {
    type: "object" as const,
    properties: {
      id: { type: "number" as const },
      username: { type: "string" as const },
      email: { type: "string" as const },
      avatar_url: { type: "string" as const },
      created_at: { type: "string" as const },
      twofa_enabled: { type: "number" as const },
    },
  },

  // User with tokens (for auth responses)
  userWithTokens: {
    type: "object" as const,
    properties: {
      id: { type: "number" as const },
      username: { type: "string" as const },
      email: { type: "string" as const },
      avatar_url: { type: "string" as const },
      created_at: { type: "string" as const },
      twofa_enabled: { type: "number" as const },
      tokens: {
        type: "object" as const,
        properties: {
          accessToken: { type: "string" as const },
        },
      },
    },
  },

  // Array of users
  userArray: {
    type: "array" as const,
    items: {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
        username: { type: "string" as const },
        email: { type: "string" as const },
        avatar_url: { type: "string" as const },
        created_at: { type: "string" as const },
      },
    },
  },

  // Match object
  match: {
    type: "object" as const,
    properties: {
      id: { type: "number" as const },
      winner_id: { type: "number" as const },
      loser_id: { type: "number" as const },
      winner_name: { type: "string" as const },
      loser_name: { type: "string" as const },
      winner_score: { type: "number" as const },
      loser_score: { type: "number" as const },
      played_at: { type: "string" as const },
    },
  },

  // Array of matches
  matchArray: {
    type: "array" as const,
    items: {
      type: "object" as const,
      properties: {
        id: { type: "number" as const },
        winner_id: { type: "number" as const },
        loser_id: { type: "number" as const },
        winner_name: { type: "string" as const },
        loser_name: { type: "string" as const },
        winner_score: { type: "number" as const },
        loser_score: { type: "number" as const },
        played_at: { type: "string" as const },
      },
    },
  },
};
