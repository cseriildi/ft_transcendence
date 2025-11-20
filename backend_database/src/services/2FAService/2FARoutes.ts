import { FastifyInstance } from "fastify";
import { twoFAController } from "./2FAController.ts";
import type {
  Setup2FAData,
  Verify2FARequest,
  Enable2FARequest,
  Disable2FARequest,
  Verify2FAData,
} from "./2FATypes";
import { ApiResponse } from "../../types/commonTypes.ts";
import { requireAuth } from "../../middleware/authMiddleware.ts";
import { TwoFASchemas } from "./2FASchemas.ts";

export default async function twoFARoutes(fastify: FastifyInstance) {
  // Setup 2FA - generates secret and QR code
  fastify.get<{
    Params: { userId: string };
    Reply: ApiResponse<Setup2FAData>;
  }>(
    "/2fa/setup/:userId",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["2fa"],
        description: "Setup 2FA for a user - generates secret and QR code (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...TwoFASchemas.setup,
      },
    },
    twoFAController.setup2FA
  );

  // Verify token (without enabling)
  fastify.post<{
    Body: Verify2FARequest;
    Reply: ApiResponse<Verify2FAData>;
  }>(
    "/2fa/verify",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["2fa"],
        description: "Verify 2FA token without enabling (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...TwoFASchemas.verify,
      },
    },
    twoFAController.verify2FA
  );

  // Enable 2FA (requires valid token)
  fastify.post<{
    Body: Enable2FARequest;
    Reply: ApiResponse<{ enabled: boolean }>;
  }>(
    "/2fa/enable",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["2fa"],
        description: "Enable 2FA for user account (requires authentication and valid token)",
        security: [{ bearerAuth: [] }],
        ...TwoFASchemas.enable,
      },
    },
    twoFAController.enable2FA
  );

  // Disable 2FA (requires valid token)
  fastify.post<{
    Body: Disable2FARequest;
    Reply: ApiResponse<{ enabled: boolean }>;
  }>(
    "/2fa/disable",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["2fa"],
        description: "Disable 2FA for user account (requires authentication and valid token)",
        security: [{ bearerAuth: [] }],
        ...TwoFASchemas.disable,
      },
    },
    twoFAController.disable2FA
  );
}
