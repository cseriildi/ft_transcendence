import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { errors } from "../../utils/errorUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import type {
  Setup2FAResponse,
  Verify2FARequest,
  Enable2FARequest,
  Disable2FARequest,
  Verify2FAResponse,
} from "./2FATypes";

export const twoFAController = {

  setup2FA: createHandler<{ Params:{userId :string} },  Setup2FAResponse>(
    async (request, { db, reply}) => {
      const userId = parseInt(request.params.userId);

      if (isNaN(userId)) {
        throw errors.validation("Invalid user ID");
      }

      // Check if user exists
      const user = await db.get<{ username: string }>(
            "SELECT username FROM users WHERE id = ?",
            [userId]
          );

      if (!user) {
        throw errors.notFound("User");
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Pong (${user.username})`,
        issuer: "Pong",
      });

      // Store secret in database (not enabled yet)
      await db.run(
        "UPDATE users SET twofa_secret = ? WHERE id = ?",
        [secret.base32, userId]
      );

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
    }
  ),

  verify2FA: createHandler<{Body: Verify2FARequest}, Verify2FAResponse>(
    async (request, {db}) =>{
      const {userId, token} = request.body;

      const user = await db.get<{username : string, twofa_secret: string}>(
        "SELECT username, twofa_secret FROM users WHERE id = ?",
        [userId]
      );

      if (!user){
        throw errors.notFound("User not found");
      }

      if (!user.twofa_secret){
        throw errors.validation("2FA is not set up for this user");
      }

      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token,
        window: 1, // Allow a 1-step window (30 seconds before or after)
      });

      return ApiResponseHelper.success(
        { valid: verified },
        verified ? "Token verified" : "Invalid 2FA token"
      );
    }
  ),

  enable2FA: createHandler<{Body : Enable2FARequest}, {enabled: boolean} >(
    async (request, {db, reply}) =>{
      const { userId, token } = request.body;
      const user = await db.get<{ twofa_secret: string, twofa_enabled: number }>(
        "SELECT twofa_secret, twofa_enabled FROM users WHERE id = ?",
        [userId]
      );

      if (!user) {
        throw errors.notFound("User not found");
      }
      
      if (!user.twofa_secret) {
        throw errors.validation("2FA is not set up for this user");
      }

      if (user.twofa_enabled) {
        throw errors.validation("2FA is already enabled");
      }

      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token,
        window: 1,
      });

      if (!verified) {
        throw errors.validation("Invalid 2FA token");
      }

      await db.run(
        "UPDATE users SET twofa_enabled = 1 WHERE id = ?",
        [userId]
      );

      reply.code(201); 
      return ApiResponseHelper.success({ enabled: true }, "2FA enabled");
    }
  ),

  disable2FA: createHandler<{Body: Disable2FARequest}, {disabled: boolean}>(
    async (request, {db}) =>{
        const { userId, token } = request.body;
      const user = await db.get<{ twofa_secret: string, twofa_enabled: number }>(
        "SELECT twofa_secret, twofa_enabled FROM users WHERE id = ?",
        [userId]
      );

      if (!user) {
        throw errors.notFound("User not found");
      }

      if (!user.twofa_secret) {
        throw errors.validation("2FA is not set up for this user");
      }

      if (!user.twofa_enabled) {
        throw errors.validation("2FA is not enabled");
      }
      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token,
        window: 1,
      });

      if (!verified) {
        throw errors.validation("Invalid 2FA token");
      }

      await db.run(
        "UPDATE users SET twofa_enabled = 0, twofa_secret = NULL WHERE id = ?",
        [userId]
      );

      return ApiResponseHelper.success({ enabled: false }, "2FA disabled");
    }
  )

};
