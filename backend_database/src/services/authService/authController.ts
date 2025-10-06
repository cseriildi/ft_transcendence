// src/routes/users.ts
import {
  CreateUserBody,
  CreateUserResponse,
  UserLoginResponse,
  UserLoginBody,
} from "./authTypes.ts";
import { User } from "../userService/userTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import { AuthSchemaValidator } from "./authSchemas.ts";
import bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken, createJti, verifyRefreshToken} from "../../utils/authUtils.ts";

export const authController = {

  refresh: createHandler<{}, UserLoginResponse>(
    async (request, context) => {
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
        
        const newJti = createJti();
        const newRefreshToken = await signRefreshToken(user.id, newJti);
        const refreshHash = await bcrypt.hash(newRefreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await db.run("DELETE FROM refresh_tokens WHERE jti = ?", [decoded.jti]);
        await db.run(
          "INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
          [newJti, user.id, refreshHash, expiresAt]
        );

        reply.setCookie("refresh_token", newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/auth",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return ApiResponseHelper.success(
          {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
            tokens: { accessToken },
          },
          "Token refreshed successfully"
        );
      } catch (err: any) {
        throw err;
      }
    }
  ),

  logout: createHandler(
    async (request, { db, reply }) => {
      
      const refreshToken = request.cookies.refresh_token;
      if (!refreshToken) {
        throw errors.unauthorized("No refresh token provided");
      }

      try {
        // Verify refresh token to get jti
        const decoded = await verifyRefreshToken(refreshToken);
        const jti = decoded.jti!;

        // Revoke the refresh token in database
        const result = await db.run(
          "UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?",
          [jti]
        );

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
    }
  ),

  createUser: createHandler<{ Body: CreateUserBody }, CreateUserResponse>(
      async (request, { db, reply }) => {
      const valid = AuthSchemaValidator.validateCreateUser(request.body);
      if (!valid) throw errors.validation("Invalid request body");
      if (request.body.password !== request.body.confirmPassword) {
        throw errors.validation("Passwords do not match");
      }

      const { username, email } = request.body || {};

      try {
        const hash = await bcrypt.hash(request.body.password, 10);
        const result = await db.run(
          "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
          [username.trim(), email.trim(), hash]
        );

        const accessToken = await signAccessToken(result.lastID);
        const jti = createJti();
        const refreshToken = await signRefreshToken(result.lastID, jti);
        const refreshHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

           await db.run(
          "INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
          [jti, result.lastID, refreshHash, expiresAt]
        );

        reply.setCookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/auth",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        });

        reply.status(201);
        return ApiResponseHelper.success(
          {
            id: result.lastID,
            username: username.trim(),
            email: email.trim(),
            created_at: new Date().toISOString(),
            tokens: { accessToken },
          },
          "User created"
        );
      } catch (err: any) {
        if (err.message?.includes("UNIQUE constraint")) {
          throw errors.conflict("Username or email already exists");
        }
        throw err; // Re-throw other database errors
      }
    }
  ),

  loginUser: createHandler<{ Body: UserLoginBody }, UserLoginResponse>(
      async (request, { db, reply }) => {
      const valid = AuthSchemaValidator.validateUserLogin(request.body);
      if (!valid) throw errors.validation("Invalid request body");
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
        const jti = createJti();
        const refreshToken = await signRefreshToken(result.id, jti);
        const refreshHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

         await db.run(
          "INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
          [jti, result.id, refreshHash, expiresAt]
        );

        // Set refresh token as HttpOnly cookie
        reply.setCookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/auth",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        });


        reply.status(200);
        return ApiResponseHelper.success(
          {
            id: result.id,
            username: result.username,
            email: email.trim(),
            created_at: result.created_at,
            tokens: { accessToken },
          },
          "User logged in successfully"
        );
    } catch (err: any) {
        throw err; // Re-throw other database errors
      }
    }
  ),
};
