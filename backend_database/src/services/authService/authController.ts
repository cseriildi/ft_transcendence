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
import { copyDefaultAvatar, deleteUploadedFile } from "../../utils/uploadUtils.ts";

export const authController = {
  verifyToken: createHandler<{}>(async (request, { db }) => {
    const dbUser = await db.get<User>(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [request.user!.id]
    );
    if (!dbUser) {
      throw errors.notFound("User not found");
    }
    return ApiResponseHelper.success({ verified: true }, "Token is valid and user exists");
  }),

  refresh: createHandler<{}, ApiResponse<AuthUserData>>(async (request, context) => {
    const { db, reply } = context;

    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      throw errors.unauthorized("No refresh token provided");
    }

    try {
      // Verify refresh token and get user ID
      const decoded = await verifyRefreshToken(refreshToken);
      const userId = parseInt(decoded.sub!);
      const jti = decoded.jti!;

      const storedToken = await db.get(
        "SELECT * FROM refresh_tokens WHERE jti = ? AND user_id = ? AND revoked = 0 AND expires_at > datetime('now')",
        [jti, userId]
      );

      if (!storedToken) {
        throw errors.unauthorized("Invalid or expired refresh token");
      }

      const tokenMatch = await bcrypt.compare(refreshToken, storedToken.token_hash);
      if (!tokenMatch) {
        throw errors.unauthorized("Invalid refresh token");
      }

      const user = await db.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        [userId]
      );

      if (!user) {
        throw errors.notFound("User not found");
      }

      const accessToken = await signAccessToken(user.id);

      // Delete old refresh token and generate new one
      await db.run("DELETE FROM refresh_tokens WHERE jti = ?", [decoded.jti]);
      const newRefreshToken = await generateAndStoreRefreshToken(db, user.id);
      setRefreshTokenCookie(reply, newRefreshToken);

      // Retrieve avatar URL using helper
      const avatar_url = await db.getAvatarUrl(user.id);

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
    } catch (err: any) {
      throw err;
    }
  }),

  logout: createHandler(async (request, { db, reply }) => {
    const refreshToken = request.cookies.refresh_token;
    if (!refreshToken) {
      throw errors.unauthorized("No refresh token provided");
    }

    try {
      // Verify refresh token to get jti
      const decoded = await verifyRefreshToken(refreshToken);
      const jti = decoded.jti!;

      // Revoke the refresh token in database
      const result = await db.run("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", [jti]);

      // Clear the refresh token cookie
      reply.clearCookie("refresh_token", { path: "/auth" });

      return ApiResponseHelper.success(
        { message: "Logged out successfully" },
        "Logged out successfully"
      );
    } catch (err: any) {
      // Even if token is invalid/expired, clear the cookie
      reply.clearCookie("refresh_token", { path: "/auth" });
      throw errors.unauthorized("Invalid refresh token");
    }
  }),

  createUser: createHandler<{ Body: CreateUserBody }, ApiResponse<AuthUserData>>(
    async (request, { db, reply }) => {
      if (request.body.password !== request.body.confirmPassword) {
        throw errors.validation("Passwords do not match");
      }
      const emailExists = await db.get("SELECT id FROM users WHERE email = ?", [
        request.body.email,
      ]);
      const userNameExists = await db.get("SELECT id FROM users WHERE username = ?", [
        request.body.username,
      ]);

      if (emailExists && userNameExists) {
        throw errors.conflict("Email and username are already exist");
      }
      if (emailExists) {
        throw errors.conflict("Email is already exists");
      }
      if (userNameExists) {
        throw errors.conflict("Username is already exists");
      }
      const { username, email } = request.body || {};

      const hash = await bcrypt.hash(request.body.password, 10);
      const result = await db.run(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        [username.trim(), email.trim(), hash]
      );

      const accessToken = await signAccessToken(result.lastID);
      const refreshToken = await generateAndStoreRefreshToken(db, result.lastID);
      setRefreshTokenCookie(reply, refreshToken);

      // Copy default avatar for new user
      const avatar = await copyDefaultAvatar(result.lastID);
      const insert = await db.run(
        "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
        [
          result.lastID,
          avatar.fileUrl,
          avatar.filePath,
          avatar.fileName,
          avatar.mimeType,
          avatar.fileSize,
        ]
      );
      if (!insert) {
        await deleteUploadedFile(avatar.fileUrl);
        await db.run("DELETE FROM users WHERE id = ?", [result.lastID]);
        throw errors.internal(
          "Failed to assign default avatar to new user, registration rolled back, please retry"
        );
      }

      // Retrieve avatar URL using helper
      const avatar_url = await db.getAvatarUrl(result.lastID);

      reply.status(201);
      return ApiResponseHelper.success(
        {
          id: result.lastID,
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
      try {
        const result = await db.get<User & { password_hash: string }>(
          "SELECT id, username, email, created_at, password_hash FROM users WHERE email = ?",
          [email.trim()]
        );
        if (!result) {
          throw errors.unauthorized("Invalid email");
        }
        const passwordMatch = await bcrypt.compare(password, result.password_hash);
        if (!passwordMatch) {
          throw errors.unauthorized("Invalid password");
        }

        const accessToken = await signAccessToken(result.id);
        const refreshToken = await generateAndStoreRefreshToken(db, result.id);
        setRefreshTokenCookie(reply, refreshToken);

        // Retrieve avatar URL using helper
        const avatar_url = await db.getAvatarUrl(result.id);

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
      } catch (err: any) {
        throw err;
      }
    }
  ),
};
