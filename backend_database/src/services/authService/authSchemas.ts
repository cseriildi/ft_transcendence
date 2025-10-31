import { createResponseSchema, commonDataSchemas } from "../../utils/schemaUtils.ts";

export const AuthSchemas = {
  // POST /auth/register
  register: {
    body: {
      type: "object" as const,
      properties: {
        username: { type: "string", minLength: 3, maxLength: 15 },
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8, maxLength: 20 },
        confirmPassword: { type: "string", minLength: 8 }
      },
      required: ["username", "email", "password", "confirmPassword"],
      additionalProperties: false
    },
    response: createResponseSchema(201, commonDataSchemas.userWithTokens, [400, 409])
  },

  // POST /auth/login
  login: {
    body: {
      type: "object" as const,
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string"}
      },
      required: ["email", "password"],
      additionalProperties: false
    },
    response: createResponseSchema(200, commonDataSchemas.userWithTokens, [401])
  },

  // POST /auth/refresh
  refresh: {
    response: createResponseSchema(200, commonDataSchemas.userWithTokens, [401])
  },

  // POST /auth/logout
  logout: {
    response: createResponseSchema(200, {
      type: "object" as const,
      properties: {
        message: { type: "string" as const }
      }
    }, [401])
  },

  // GET /auth/verify
  verify: {
    response: createResponseSchema(200, {
      type: "object" as const,
      properties: {
        verified: { type: "boolean" as const }
      }
    }, [401, 404])
  }
};

