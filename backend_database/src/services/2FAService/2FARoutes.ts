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

export default async function twoFARoutes(fastify: FastifyInstance) {
  // Setup 2FA - generates secret and QR code
  fastify.get<{
    Params: { userId: string };
    Reply: ApiResponse<Setup2FAData>;
  }>("/2fa/setup/:userId", twoFAController.setup2FA);

  // Verify token (without enabling)
  fastify.post<{
    Body: Verify2FARequest;
    Reply: ApiResponse<Verify2FAData>;
  }>("/2fa/verify", twoFAController.verify2FA);

  // Enable 2FA (requires valid token)
  fastify.post<{
    Body: Enable2FARequest;
    Reply: ApiResponse<{ enabled: boolean }>;
  }>("/2fa/enable", twoFAController.enable2FA);

  // Disable 2FA (requires valid token)
  fastify.post<{
    Body: Disable2FARequest;
    Reply: ApiResponse<{ enabled: boolean }>;
  }>("/2fa/disable", twoFAController.disable2FA);
}
