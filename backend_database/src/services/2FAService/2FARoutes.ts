import { FastifyInstance } from "fastify";
import { twoFAController } from "./2FAController.ts";
import type { Setup2FAData, TwoFACodeRequest, Verify2FAData } from "./2FATypes";
import { ApiResponse } from "../../types/commonTypes.ts";
import { requireAuth } from "../../middleware/authMiddleware.ts";
import { TwoFASchemas } from "./2FASchemas.ts";

export default async function twoFARoutes(fastify: FastifyInstance) {
  // Setup 2FA - generates secret and QR code
  fastify.post<{
    Params: { userId: string };
    Reply: ApiResponse<Setup2FAData>;
  }>(
    "/users/:userId/2fa/setup",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["2fa"],
        description:
          "Setup 2FA for a user - generates secret and QR code (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...TwoFASchemas.setup,
      },
    },
    twoFAController.setup2FA
  );

  // Verify token (without enabling)
  fastify.post<{
    Params: { userId: string };
    Body: TwoFACodeRequest;
    Reply: ApiResponse<Verify2FAData>;
  }>(
    "/users/:userId/2fa/verify",
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
    Params: { userId: string };
    Body: TwoFACodeRequest;
    Reply: ApiResponse<{ enabled: boolean }>;
  }>(
    "/users/:userId/2fa/enable",
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
    Params: { userId: string };
    Body: TwoFACodeRequest;
    Reply: ApiResponse<{ enabled: boolean }>;
  }>(
    "/users/:userId/2fa/disable",
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
