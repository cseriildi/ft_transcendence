import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { requestErrors } from "../../utils/errorUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { FastifyRequest, FastifyReply } from "fastify";
import type {
  Setup2FAData,
  Verify2FARequest,
  Enable2FARequest,
  Disable2FARequest,
  Verify2FAData,
} from "./2FATypes";
import { ApiResponse } from "../../types/commonTypes.ts";
import { checkRateLimit, resetRateLimit } from "../../utils/rateLimitUtils.ts";
import { ensureUserOwnership } from "../../utils/authUtils.ts";

export const twoFAController = {
  setup2FA: async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<ApiResponse<Setup2FAData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const userId = parseInt(request.params.userId);

    if (isNaN(userId)) {
      throw errors.validation("Invalid user ID", {
        userIdParam: request.params.userId,
      });
    }

    // Authorization: Ensure authenticated user matches the userId parameter
    ensureUserOwnership(request.user!.id, userId);

    // Check if user exists
    const user = await db.get<{ username: string }>("SELECT username FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      throw errors.notFound("User", { targetUserId: userId });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Pong (${user.username})`,
      issuer: "Pong",
    });

    // Store secret in database (not enabled yet)
    await db.run("UPDATE users SET twofa_secret = ? WHERE id = ?", [secret.base32, userId]);

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    reply.code(201);
    return ApiResponseHelper.success(
      {
        secret: secret.base32,
        qrCodeUrl,
        manualEntryKey: secret.base32,
      },
      "Scan QR code with authenticator app"
    );
  },

  verify2FA: async (
    request: FastifyRequest<{ Body: Verify2FARequest }>,
    _reply: FastifyReply
  ): Promise<ApiResponse<Verify2FAData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { userId, token } = request.body;

    // Authorization: Ensure authenticated user matches the userId in request body
    ensureUserOwnership(request.user!.id, userId);

    // Rate limit: 5 attempts per 15 minutes per user (brute force protection)
    // 6-digit code = 1,000,000 combinations, lockout prevents enumeration
    checkRateLimit(`2fa:${userId}`, 5, 15 * 60, 15);

    const user = await db.get<{ username: string; twofa_secret: string; twofa_enabled: number }>(
      "SELECT username, twofa_secret, twofa_enabled FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw errors.notFound("User", { targetUserId: userId });
    }

    if (!user.twofa_enabled) {
      throw errors.validation("2FA is not enabled for this user", { targetUserId: userId });
    }

    if (!user.twofa_secret) {
      throw errors.validation("2FA is not set up for this user", { targetUserId: userId });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twofa_secret,
      encoding: "base32",
      token,
      window: 1, // Allow a 1-step window (30 seconds before or after)
    });

    // Clear rate limit on successful verification
    if (verified) {
      resetRateLimit(`2fa:${userId}`);
    }

    return ApiResponseHelper.success(
      { valid: verified },
      verified ? "Token verified" : "Invalid 2FA token"
    );
  },

  enable2FA: async (
    request: FastifyRequest<{ Body: Enable2FARequest }>,
    reply: FastifyReply
  ): Promise<ApiResponse<{ enabled: boolean }>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { userId, token } = request.body;

    // Authorization: Ensure authenticated user matches the userId in request body
    ensureUserOwnership(request.user!.id, userId);

    // Rate limit: 5 attempts per 15 minutes per user (same as verify)
    checkRateLimit(`2fa:${userId}`, 5, 15 * 60, 15);

    const user = await db.get<{ twofa_secret: string; twofa_enabled: number }>(
      "SELECT twofa_secret, twofa_enabled FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw errors.notFound("User", { targetUserId: userId });
    }

    if (!user.twofa_secret) {
      throw errors.validation("2FA is not set up for this user", { targetUserId: userId });
    }

    if (user.twofa_enabled) {
      throw errors.validation("2FA is already enabled", { targetUserId: userId });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twofa_secret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      throw errors.validation("Invalid 2FA token", { targetUserId: userId });
    }

    // Clear rate limit on successful enable
    resetRateLimit(`2fa:${userId}`);

    await db.run("UPDATE users SET twofa_enabled = 1 WHERE id = ?", [userId]);

    reply.code(201);
    return ApiResponseHelper.success({ enabled: true }, "2FA enabled");
  },

  disable2FA: async (
    request: FastifyRequest<{ Body: Disable2FARequest }>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ enabled: boolean }>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { userId, token } = request.body;

    // Authorization: Ensure authenticated user matches the userId in request body
    ensureUserOwnership(request.user!.id, userId);

    // Rate limit: 5 attempts per 15 minutes per user (same as verify/enable)
    checkRateLimit(`2fa:${userId}`, 5, 15 * 60, 15);

    const user = await db.get<{ twofa_secret: string; twofa_enabled: number }>(
      "SELECT twofa_secret, twofa_enabled FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw errors.notFound("User", { targetUserId: userId });
    }

    if (!user.twofa_enabled) {
      throw errors.validation("2FA is not enabled for this user", { targetUserId: userId });
    }

    if (!user.twofa_secret) {
      throw errors.validation("2FA is not set up for this user", { targetUserId: userId });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twofa_secret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      throw errors.validation("Invalid 2FA token", { targetUserId: userId });
    }

    // Clear rate limit on successful disable
    resetRateLimit(`2fa:${userId}`);

    await db.run("UPDATE users SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?", [userId]);

    return ApiResponseHelper.success({ enabled: false }, "2FA disabled");
  },
};
