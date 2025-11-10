// src/routes/users.ts
import { CreateUserBody, UserLoginBody, AuthUserData } from "./authTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import bcrypt from "bcrypt";
import {
  signAccessToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  generateAndStoreRefreshToken,
} from "../../utils/authUtils.ts";
import { copyDefaultAvatar } from "../../utils/uploadUtils.ts";
import { getAvatarUrl } from "../userService/userUtils.ts";
import { assertPasswordValid } from "../../utils/passwordUtils.ts";
import { checkRateLimit, resetRateLimit } from "../../utils/rateLimitUtils.ts";

export const authController = {
  verifyToken: createHandler<{}>(async (request, { db }) => {
    const dbUser = await db.get<User>(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [request.user!.id]
    );
    if (!dbUser) {
      throw errors.notFound("User", {
        userId: request.user!.id,
        endpoint: "verifyToken",
      });
    }
    return ApiResponseHelper.success({ verified: true }, "Token is valid and user exists");
  }),

  refresh: createHandler<{}, ApiResponse<AuthUserData>>(async (request, context) => {
    const { db, reply } = context;

    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      throw errors.unauthorized("No refresh token provided", {
        endpoint: "refresh",
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
      throw errors.unauthorized("Invalid or expired refresh token", {
        userId,
        jti,
        endpoint: "refresh",
      });
    }

    const tokenMatch = await bcrypt.compare(refreshToken, storedToken.token_hash);
    if (!tokenMatch) {
      throw errors.unauthorized("Invalid refresh token", {
        userId,
        jti,
        endpoint: "refresh",
        reason: "token_mismatch",
      });
    }

    const user = await db.get<User>(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      throw errors.notFound("User", {
        userId,
        endpoint: "refresh",
      });
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
  }),

  logout: createHandler(async (request, { db, reply }) => {
    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      throw errors.unauthorized("No refresh token provided", {
        endpoint: "logout",
        hasCookie: !!request.cookies.refresh_token,
      });
    }

    try {
      // Verify refresh token to get jti
      const decoded = await verifyRefreshToken(refreshToken);
      const jti = decoded.jti!;

      // Revoke the refresh token in database
      await db.run("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", [jti]);

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
      throw errors.unauthorized("Invalid refresh token", {
        endpoint: "logout",
      });
    }
  }),

  createUser: createHandler<{ Body: CreateUserBody }, ApiResponse<AuthUserData>>(
    async (request, { db, reply }) => {
      // Rate limit: 5 registration attempts per 5 minutes per IP
      const clientIp = request.ip;
      checkRateLimit(`register:${clientIp}`, 5, 5 * 60);

      // Validate password strength
      assertPasswordValid(request.body.password, {
        endpoint: "register",
        email: request.body.email,
      });

      if (request.body.password !== request.body.confirmPassword) {
        throw errors.validation("Passwords do not match", {
          endpoint: "register",
        });
      }
      const emailExists = await db.get("SELECT id FROM users WHERE email = ?", [
        request.body.email,
      ]);
      const userNameExists = await db.get("SELECT id FROM users WHERE username = ?", [
        request.body.username,
      ]);

      if (emailExists && userNameExists) {
        throw errors.conflict("Email and username are already exist", {
          email: request.body.email,
          username: request.body.username,
          endpoint: "register",
        });
      }
      if (emailExists) {
        throw errors.conflict("Email is already exists", {
          email: request.body.email,
          endpoint: "register",
        });
      }
      if (userNameExists) {
        throw errors.conflict("Username is already exists", {
          username: request.body.username,
          endpoint: "register",
        });
      }
      const { username, email } = request.body || {};

      const hash = await bcrypt.hash(request.body.password, 10);

      // Step 1: Create user in database transaction (atomic)
      const userId = await db.transaction(async (tx) => {
        const result = await tx.run(
          "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
          [username.trim(), email.trim(), hash]
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
        throw errors.internal("Failed to create user avatar", {
          userId,
          endpoint: "register",
        });
      }

      // Step 3: Store avatar metadata in database
      try {
        await db.run(
          "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
          [
            userId,
            avatar.fileUrl,
            avatar.filePath,
            avatar.fileName,
            avatar.mimeType,
            avatar.fileSize,
          ]
        );
      } catch (err) {
        // Compensating actions: cleanup filesystem and database
        request.log.error(
          { userId, error: err },
          "Avatar DB insert failed, cleaning up file and user"
        );
        // TODO: Add deleteAvatar(userId) utility for proper cleanup
        await db.run("DELETE FROM users WHERE id = ?", [userId]);
        throw errors.internal("Failed to store avatar metadata", {
          userId,
          endpoint: "register",
        });
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
          username,
          email,
        },
        "User registered successfully"
      );

      reply.status(201);
      return ApiResponseHelper.success(
        {
          id: userId,
          username: username.trim(),
          email: email.trim(),
          created_at: new Date().toISOString(),
          avatar_url,
          tokens: { accessToken },
        },
        "User created"
      );
    }
  ),

  loginUser: createHandler<{ Body: UserLoginBody }, ApiResponse<AuthUserData>>(
    async (request, { db, reply }) => {
      const { email, password } = request.body || {};

      // Rate limit: 5 login attempts per 5 minutes per IP
      const clientIp = request.ip;
      checkRateLimit(`login:${clientIp}`, 5, 5 * 60);

      try {
        const result = await db.get<User & { password_hash: string }>(
          "SELECT id, username, email, created_at, password_hash FROM users WHERE email = ?",
          [email.trim()]
        );
        if (!result) {
          throw errors.unauthorized("Invalid email", {
            email: email.trim(),
            endpoint: "login",
          });
        }
        const passwordMatch = await bcrypt.compare(password, result.password_hash);
        if (!passwordMatch) {
          throw errors.unauthorized("Invalid password", {
            userId: result.id,
            email: email.trim(),
            endpoint: "login",
          });
        }

        const accessToken = await signAccessToken(result.id);
        const refreshToken = await generateAndStoreRefreshToken(db, result.id);
        setRefreshTokenCookie(reply, refreshToken);

        // Clear rate limit on successful login
        resetRateLimit(`login:${clientIp}`);

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
            email: email.trim(),
            created_at: result.created_at,
            avatar_url,
            tokens: { accessToken },
          },
          "User logged in successfully"
        );
      } catch (err: unknown) {
        throw err;
      }
    }
  ),
};
