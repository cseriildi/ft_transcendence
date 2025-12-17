// src/routes/users.ts
import {
  CreateUserBody,
  UserLoginBody,
  AuthUserData,
  Auth2FARequiredResponse,
} from "./authTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { requestErrors } from "../../utils/errorUtils.ts";
import { sanitize } from "../../utils/sanitizationUtils.ts";
import "../../types/fastifyTypes.ts";
import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import {
  signAccessToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  generateAndStoreRefreshToken,
  signTemporaryToken,
  verifyTemporaryToken,
} from "../../utils/authUtils.ts";
import { copyDefaultAvatar, deleteUploadedFile } from "../../utils/uploadUtils.ts";
import { getAvatarUrl } from "../userService/userUtils.ts";
import { assertPasswordValid } from "../../utils/passwordUtils.ts";
import { checkRateLimit, resetRateLimit } from "../../utils/rateLimitUtils.ts";

export const authController = {
  verifyToken: async (request: FastifyRequest, _reply: FastifyReply) => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const dbUser = await db.get<User>(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [request.user!.id]
    );
    if (!dbUser) {
      throw errors.notFound("User");
    }
    return ApiResponseHelper.success({ verified: true }, "Token is valid and user exists");
  },

  refresh: async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ApiResponse<AuthUserData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);

    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      throw errors.unauthorized("No refresh token provided", {
        hasCookie: !!request.cookies.refresh_token,
      });
    }

    // Verify refresh token and get user ID
    const decoded = await verifyRefreshToken(refreshToken);
    const userId = parseInt(decoded.sub!);
    const jti = decoded.jti!;

    const storedToken = await db.get<{ token_hash: string }>(
      "SELECT * FROM refresh_tokens WHERE jti = ? AND user_id = ? AND revoked = 0 AND expires_at > datetime('now')",
      [jti, userId]
    );

    if (!storedToken) {
      throw errors.unauthorized("Invalid or expired refresh token", { jti });
    }

    const tokenMatch = await bcrypt.compare(refreshToken, storedToken.token_hash);
    if (!tokenMatch) {
      throw errors.unauthorized("Invalid refresh token", { jti, reason: "token_mismatch" });
    }

    const user = await db.get<User>(
      "SELECT id, username, email, created_at, twofa_enabled FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw errors.notFound("User");
    }

    const accessToken = await signAccessToken(user.id);

    // Token rotation: delete old token, create new one (must be atomic)
    const newRefreshToken = await db.transaction(async (tx) => {
      await tx.run("DELETE FROM refresh_tokens WHERE jti = ?", [decoded.jti]);
      const newToken = await generateAndStoreRefreshToken(tx, user.id);
      return newToken;
    });

    // Avatar fetch is independent read operation - no transactional relationship
    const avatar_url = await getAvatarUrl(db, user.id);

    setRefreshTokenCookie(reply, newRefreshToken);

    return ApiResponseHelper.success(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        avatar_url,
        twofa_enabled: user.twofa_enabled,
        tokens: { accessToken },
      },
      "Token refreshed successfully"
    );
  },

  logout: async (request: FastifyRequest, reply: FastifyReply) => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      throw errors.unauthorized("No refresh token provided", {
        hasCookie: !!request.cookies.refresh_token,
      });
    }

    try {
      const decoded = await verifyRefreshToken(refreshToken);
      const jti = decoded.jti!;

      await db.run("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", [jti]);

      const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [pastTime, decoded.sub]);

      request.log.info(
        {
          userId: decoded.sub,
          jti,
        },
        "User logged out successfully"
      );

      reply.clearCookie("refresh_token", { path: "/auth" });

      return ApiResponseHelper.success(
        { message: "Logged out successfully" },
        "Logged out successfully"
      );
    } catch {
      // Even if token is invalid/expired, clear the cookie
      reply.clearCookie("refresh_token", { path: "/auth" });

      request.log.warn("Logout attempted with invalid refresh token");

      throw errors.unauthorized("Invalid refresh token");
    }
  },

  createUser: async (
    request: FastifyRequest<{ Body: CreateUserBody }>,
    reply: FastifyReply
  ): Promise<ApiResponse<AuthUserData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    // Rate limit: 5 registration attempts per 5 minutes per IP
    const clientIp = request.ip;
    checkRateLimit(`register:${clientIp}`, 5, 5 * 60);

    assertPasswordValid(request.body.password, {
      endpoint: "register",
      email: request.body.email,
    });

    if (request.body.password !== request.body.confirmPassword) {
      throw errors.validation("Passwords do not match");
    }
    const emailExists = await db.get("SELECT id FROM users WHERE email = ?", [request.body.email]);
    const userNameExists = await db.get("SELECT id FROM users WHERE username = ?", [
      request.body.username,
    ]);

    if (emailExists && userNameExists) {
      throw errors.conflict("Email and username already exist", {
        email: request.body.email,
        username: request.body.username,
      });
    }
    if (emailExists) {
      throw errors.conflict("Email already exists", { email: request.body.email });
    }
    if (userNameExists) {
      throw errors.conflict("Username already exists", { username: request.body.username });
    }

    const cleanUsername = sanitize.username(request.body.username);
    const cleanEmail = sanitize.email(request.body.email);

    const hash = await bcrypt.hash(request.body.password, 10);

    // Step 1: Create user in database transaction (atomic)
    const userId = await db.transaction(async (tx) => {
      const result = await tx.run(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        [cleanUsername, cleanEmail, hash]
      );
      return result.lastID;
    });

    // Step 2: Filesystem operation outside transaction
    let avatar;
    try {
      avatar = await copyDefaultAvatar(userId);
    } catch (err) {
      // rollback user creation if file copy fails
      request.log.error(
        { userId, error: err },
        "Avatar copy failed during registration, rolling back user creation"
      );
      await db.run("DELETE FROM users WHERE id = ?", [userId]);
      throw errors.internal("Failed to create user avatar", { userId });
    }

    // Step 3: Store avatar  database
    try {
      await db.run(
        "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, avatar.fileUrl, avatar.filePath, avatar.fileName, avatar.mimeType, avatar.fileSize]
      );
    } catch (err) {
      // cleanup filesystem and database
      request.log.error(
        { userId, error: err },
        "Avatar DB insert failed, cleaning up file and user"
      );
      await deleteUploadedFile(avatar.fileUrl);
      await db.run("DELETE FROM users WHERE id = ?", [userId]);
      throw errors.internal("Failed to store avatar metadata", { userId });
    }

    // Step 4: Fetch avatar URL for response
    const avatar_url = await getAvatarUrl(db, userId);

    const accessToken = await signAccessToken(userId);
    const refreshToken = await generateAndStoreRefreshToken(db, userId);
    setRefreshTokenCookie(reply, refreshToken);

    // Log successful registration
    request.log.info(
      {
        userId,
        username: cleanUsername,
        email: cleanEmail,
      },
      "User registered successfully"
    );

    reply.status(201);
    return ApiResponseHelper.success(
      {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        created_at: new Date().toISOString(),
        avatar_url,
        twofa_enabled: 0, // New users don't have 2FA enabled by default
        tokens: { accessToken },
      },
      "User created"
    );
  },

  loginUser: async (
    request: FastifyRequest<{ Body: UserLoginBody }>,
    reply: FastifyReply
  ): Promise<ApiResponse<AuthUserData | Auth2FARequiredResponse>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { email, password } = request.body || {};
    const cleanEmail = sanitize.email(email);
    const clientIp = request.ip;
    checkRateLimit(`login:${clientIp}`, 5, 5 * 60);

    try {
      const result = await db.get<User & { password_hash: string; twofa_enabled: number }>(
        "SELECT id, username, email, created_at, password_hash, twofa_enabled FROM users WHERE email = ?",
        [cleanEmail]
      );
      if (!result) {
        throw errors.unauthorized("Invalid email", { email: cleanEmail });
      }
      const passwordMatch = await bcrypt.compare(password, result.password_hash);
      if (!passwordMatch) {
        throw errors.unauthorized("Invalid password", { email: cleanEmail });
      }

      if (result.twofa_enabled) {
        const tempToken = await signTemporaryToken(result.id);
        resetRateLimit(`login:${clientIp}`);

        request.log.info(
          {
            userId: result.id,
            username: result.username,
            email: result.email,
          },
          "User requires 2FA verification"
        );

        reply.status(200);
        return ApiResponseHelper.success(
          {
            requires2fa: true,
            tempToken,
          },
          "2FA verification required"
        );
      }

      // No 2FA - proceed with normal login
      const accessToken = await signAccessToken(result.id);
      const refreshToken = await generateAndStoreRefreshToken(db, result.id);
      setRefreshTokenCookie(reply, refreshToken);

      // Clear rate limit on successful login
      resetRateLimit(`login:${clientIp}`);

      const now = new Date().toISOString();
      await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, result.id]);

      const avatar_url = await getAvatarUrl(db, result.id);

      request.log.info(
        {
          userId: result.id,
          username: result.username,
          email: result.email,
        },
        "User logged in successfully"
      );

      reply.status(200);
      return ApiResponseHelper.success(
        {
          id: result.id,
          username: result.username,
          email: cleanEmail,
          created_at: result.created_at,
          avatar_url,
          // Security note: Exposing 2FA status after password verification is acceptable
          // (user already authenticated, many production apps do this for UX purposes)
          twofa_enabled: result.twofa_enabled,
          tokens: { accessToken },
        },
        "User logged in successfully"
      );
    } catch (err: unknown) {
      throw err;
    }
  },

  login2FA: async (
    request: FastifyRequest<{ Body: { tempToken: string; twofa_code: string } }>,
    reply: FastifyReply
  ): Promise<ApiResponse<AuthUserData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { tempToken, twofa_code } = request.body;
    const decoded = await verifyTemporaryToken(tempToken);
    const userId = parseInt(decoded.sub!);
    checkRateLimit(`2fa-login:${userId}`, 5, 15 * 60, 15);

    const user = await db.get<User & { twofa_secret: string; twofa_enabled: number }>(
      "SELECT id, username, email, created_at, twofa_secret, twofa_enabled FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw errors.notFound("User", { targetUserId: userId });
    }

    if (!user.twofa_enabled || !user.twofa_secret) {
      throw errors.unauthorized("2FA is not enabled for this user", { targetUserId: userId });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twofa_secret,
      encoding: "base32",
      token: twofa_code,
      window: 1,
    });

    if (!verified) {
      throw errors.unauthorized("Invalid 2FA token", { targetUserId: userId });
    }

    resetRateLimit(`2fa-login:${userId}`);
    const accessToken = await signAccessToken(user.id);
    const refreshToken = await generateAndStoreRefreshToken(db, user.id);
    setRefreshTokenCookie(reply, refreshToken);

    const now = new Date().toISOString();
    await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, user.id]);

    const avatar_url = await getAvatarUrl(db, user.id);

    request.log.info(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
      },
      "User logged in successfully with 2FA"
    );

    reply.status(200);
    return ApiResponseHelper.success(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        avatar_url,
        twofa_enabled: user.twofa_enabled,
        tokens: { accessToken },
      },
      "Logged in successfully"
    );
  },
};
