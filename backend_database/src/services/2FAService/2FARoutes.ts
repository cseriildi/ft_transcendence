import { FastifyInstance } from "fastify";
import { twoFAController } from "./2FAController";
import type {
  Setup2FAResponse,
  Verify2FARequest,
  Enable2FARequest,
  Disable2FARequest,
  Verify2FAResponse,
} from "./2FATypes";

export default async function authRoutes(fastify: FastifyInstance) {
  // Setup 2FA - generates secret and QR code
  fastify.get<{
    Params: { userId: string };
    Reply: Setup2FAResponse;
  }>("/auth/2fa/setup/:userId", twoFAController.setup2FA);

  // Verify token (without enabling)
  fastify.post<{
    Body: Verify2FARequest;
    Reply: Verify2FAResponse;
  }>("/auth/2fa/verify", twoFAController.verify2FA);

  // Enable 2FA (requires valid token)
  fastify.post<{
    Body: Enable2FARequest;
    Reply: { enabled: boolean };
  }>("/auth/2fa/enable", twoFAController.enable2FA);

  // Disable 2FA (requires valid token)
  fastify.post<{
    Body: Disable2FARequest;
    Reply: { enabled: boolean };
  }>("/auth/2fa/disable", twoFAController.disable2FA);
}