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
    response: createResponseSchema(200, commonDataSchemas.userWithTokens, [401]),
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
        twofa_token: {
          type: "string",
          minLength: 6,
          maxLength: 6,
          pattern: "^[0-9]{6}$",
          description: "6-digit TOTP code from authenticator app",
        },
      },
      required: ["tempToken", "twofa_token"],
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
