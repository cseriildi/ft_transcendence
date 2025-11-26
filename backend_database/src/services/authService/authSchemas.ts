import { createResponseSchema, commonDataSchemas } from "../../utils/schemaUtils.ts";
import { getPasswordRequirements } from "../../utils/passwordUtils.ts";
import { config } from "../../config.ts";

const isProduction = config.server.env === "production";

export const AuthSchemas = {
  // POST /auth/register
  register: {
    body: {
      type: "object" as const,
      properties: {
        username: {
          type: "string",
          minLength: 3,
          maxLength: 15,
          pattern: "^[a-zA-Z0-9_-]+$",
          description: "New username (3-15 characters, alphanumeric with underscores and hyphens)",
        },
        email: { type: "string", format: "email" },
        password: {
          type: "string",
          minLength: isProduction ? 10 : 1,
          maxLength: 128,
          description: getPasswordRequirements(),
        },
        confirmPassword: {
          type: "string",
          minLength: isProduction ? 10 : 1,
          description: "Must match password field",
        },
      },
      required: ["username", "email", "password", "confirmPassword"],
      additionalProperties: false,
    },
    response: createResponseSchema(201, commonDataSchemas.userWithTokens, [400, 409]),
  },

  // POST /auth/login
  // Response can have two shapes:
  // 1. Normal login (no 2FA): Returns user data with tokens
  // 2. 2FA enabled: Returns requires2fa=true and tempToken
  login: {
    body: {
      type: "object" as const,
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string" },
      },
      required: ["email", "password"],
      additionalProperties: false,
    },
    response: {
      200: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          message: { type: "string" as const },
          timestamp: { type: "string" as const },
          data: {
            type: "object" as const,
            description: "Response data - shape varies based on 2FA status",
            properties: {
              // Normal login fields (when 2FA is NOT enabled)
              id: {
                type: "number" as const,
                description: "User ID (present when 2FA not required)",
              },
              username: {
                type: "string" as const,
                description: "Username (present when 2FA not required)",
              },
              email: {
                type: "string" as const,
                description: "Email address (present when 2FA not required)",
              },
              avatar_url: {
                type: "string" as const,
                description: "Avatar URL (present when 2FA not required)",
              },
              created_at: {
                type: "string" as const,
                description: "Account creation timestamp (present when 2FA not required)",
              },
              tokens: {
                type: "object" as const,
                description: "Authentication tokens (present when 2FA not required)",
                properties: {
                  accessToken: { type: "string" as const, description: "JWT access token" },
                },
              },
              // 2FA required fields (when 2FA IS enabled)
              requires2fa: {
                type: "boolean" as const,
                description: "Indicates 2FA verification is required (present when 2FA enabled)",
              },
              tempToken: {
                type: "string" as const,
                description:
                  "Temporary token for 2FA verification (present when 2FA enabled, valid 5 minutes)",
              },
            },
            // All properties optional - response shape changes based on 2FA status
            // Either (id, username, email, tokens) OR (requires2fa, tempToken)
            additionalProperties: false,
          },
        },
        required: ["success", "timestamp"],
      },
      401: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" as const },
          error: { type: "string" as const },
          message: { type: "string" as const },
          timestamp: { type: "string" as const },
        },
      },
    },
  },

  // POST /auth/login/2fa
  login2FA: {
    body: {
      type: "object" as const,
      properties: {
        tempToken: {
          type: "string",
          description: "Temporary token from /login response (valid for 5 minutes)",
        },
        twofa_code: {
          type: "string",
          minLength: 6,
          maxLength: 6,
          pattern: "^[0-9]{6}$",
          description: "6-digit TOTP code from authenticator app",
        },
      },
      required: ["tempToken", "twofa_code"],
      additionalProperties: false,
    },
    response: createResponseSchema(200, commonDataSchemas.userWithTokens, [401, 404, 429]),
  },

  // POST /auth/refresh
  refresh: {
    response: createResponseSchema(200, commonDataSchemas.userWithTokens, [401]),
  },

  // POST /auth/logout
  logout: {
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          message: { type: "string" as const },
        },
      },
      [401]
    ),
  },

  // GET /auth/verify
  verify: {
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          verified: { type: "boolean" as const },
        },
      },
      [401, 404]
    ),
  },
};
