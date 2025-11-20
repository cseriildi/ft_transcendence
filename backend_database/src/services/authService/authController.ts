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
import { copyDefaultAvatar } from "../../utils/uploadUtils.ts";
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
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
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
      // Verify refresh token to get jti
      const decoded = await verifyRefreshToken(refreshToken);
      const jti = decoded.jti!;

      // Revoke the refresh token in database
      await db.run("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", [jti]);

      // Set user as offline immediately after logout by setting last_seen to past time
      const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [pastTime, decoded.sub]);

      // Log successful logout
      request.log.info(
        {
          userId: decoded.sub,
          jti,
        },
        "User logged out successfully"
      );

      // Clear the refresh token cookie
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

    // Validate password strength
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

    // Sanitize input before storage (prevent XSS)
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
    // Concept: DB transactions can't control filesystem - separate systems
    let avatar;
    try {
      avatar = await copyDefaultAvatar(userId);
    } catch (err) {
      // Compensating action: rollback user creation if file copy fails
      request.log.error(
        { userId, error: err },
        "Avatar copy failed during registration, rolling back user creation"
      );
      await db.run("DELETE FROM users WHERE id = ?", [userId]);
      throw errors.internal("Failed to create user avatar", { userId });
    }

    // Step 3: Store avatar metadata in database
    try {
      await db.run(
        "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, avatar.fileUrl, avatar.filePath, avatar.fileName, avatar.mimeType, avatar.fileSize]
      );
    } catch (err) {
      // Compensating actions: cleanup filesystem and database
      request.log.error(
        { userId, error: err },
        "Avatar DB insert failed, cleaning up file and user"
      );
      // TODO: Add deleteAvatar(userId) utility for proper cleanup
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

    // Sanitize email for lookup (normalize for consistency)
    const cleanEmail = sanitize.email(email);

    // Rate limit: 5 login attempts per 5 minutes per IP
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

      // Check if user has 2FA enabled
      if (result.twofa_enabled) {
        // User has 2FA - don't issue tokens yet, return temp token for 2FA verification
        const tempToken = await signTemporaryToken(result.id);

        // Clear rate limit on successful password verification
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

      // Set user as online immediately after successful login
      const now = new Date().toISOString();
      await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, result.id]);

      // Retrieve avatar URL using helper
      const avatar_url = await getAvatarUrl(db, result.id);

      // Log successful login
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
          tokens: { accessToken },
        },
        "User logged in successfully"
      );
    } catch (err: unknown) {
      throw err;
    }
  },

  login2FA: async (
    request: FastifyRequest<{ Body: { tempToken: string; twofa_token: string } }>,
    reply: FastifyReply
  ): Promise<ApiResponse<AuthUserData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { tempToken, twofa_token } = request.body;

    // Verify temporary token
    const decoded = await verifyTemporaryToken(tempToken);
    const userId = parseInt(decoded.sub!);

    // Rate limit 2FA attempts per user (5 attempts per 15 minutes)
    checkRateLimit(`2fa-login:${userId}`, 5, 15 * 60, 15);

    // Get user's 2FA configuration
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

    // Verify 2FA token
    const verified = speakeasy.totp.verify({
      secret: user.twofa_secret,
      encoding: "base32",
      token: twofa_token,
      window: 1,
    });

    if (!verified) {
      throw errors.unauthorized("Invalid 2FA token", { targetUserId: userId });
    }

    // Clear rate limit on successful 2FA verification
    resetRateLimit(`2fa-login:${userId}`);

    // Issue real access and refresh tokens
    const accessToken = await signAccessToken(user.id);
    const refreshToken = await generateAndStoreRefreshToken(db, user.id);
    setRefreshTokenCookie(reply, refreshToken);

    // Set user as online
    const now = new Date().toISOString();
    await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, user.id]);

    // Retrieve avatar URL
    const avatar_url = await getAvatarUrl(db, user.id);

    // Log successful 2FA login
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
        tokens: { accessToken },
      },
      "Logged in successfully"
    );
  },
};
