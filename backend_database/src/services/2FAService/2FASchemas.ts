import { createResponseSchema } from "../../utils/schemaUtils.ts";

export const TwoFASchemas = {
  // GET /auth/2fa/setup/:userId
  setup: {
    params: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          pattern: "^[0-9]+$",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
    response: createResponseSchema(
      201,
      {
        type: "object" as const,
        properties: {
          secret: { type: "string" as const, description: "Base32-encoded TOTP secret" },
          qrCodeUrl: { type: "string" as const, description: "Data URL for QR code image" },
          manualEntryKey: { type: "string" as const, description: "Secret key for manual entry" },
        },
      },
      [400, 401, 404]
    ),
  },

  // POST /api/users/:userId/2fa/verify
  verify: {
    params: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          pattern: "^[0-9]+$",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
    body: {
      type: "object" as const,
      properties: {
        twofa_code: {
          type: "string",
          minLength: 6,
          maxLength: 6,
          pattern: "^[0-9]{6}$",
          description: "6-digit TOTP code",
        },
      },
      required: ["twofa_code"],
      additionalProperties: false,
    },
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          valid: { type: "boolean" as const, description: "Whether the token is valid" },
        },
      },
      [400, 401, 404, 429]
    ),
  },

  // POST /api/users/:userId/2fa/enable
  enable: {
    params: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          pattern: "^[0-9]+$",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
    body: {
      type: "object" as const,
      properties: {
        twofa_code: {
          type: "string",
          minLength: 6,
          maxLength: 6,
          pattern: "^[0-9]{6}$",
          description: "6-digit TOTP code",
        },
      },
      required: ["twofa_code"],
      additionalProperties: false,
    },
    response: createResponseSchema(
      201,
      {
        type: "object" as const,
        properties: {
          enabled: { type: "boolean" as const, description: "2FA enabled status" },
        },
      },
      [400, 401, 404, 429]
    ),
  },

  // POST /api/users/:userId/2fa/disable
  disable: {
    params: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          pattern: "^[0-9]+$",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
    body: {
      type: "object" as const,
      properties: {
        twofa_code: {
          type: "string",
          minLength: 6,
          maxLength: 6,
          pattern: "^[0-9]{6}$",
          description: "6-digit TOTP code",
        },
      },
      required: ["twofa_code"],
      additionalProperties: false,
    },
    response: createResponseSchema(
      200,
      {
        type: "object" as const,
        properties: {
          enabled: { type: "boolean" as const, description: "2FA enabled status" },
        },
      },
      [400, 401, 404]
    ),
  },
};
