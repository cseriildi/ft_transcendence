import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { FastifyRequest, FastifyReply } from "fastify";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { requestErrors } from "../../utils/errorUtils.ts";
import {
  signAccessToken,
  setRefreshTokenCookie,
  generateAndStoreRefreshToken,
} from "../../utils/authUtils.ts";
import { getAvatarUrl } from "../userService/userUtils.ts";
import {
  getGitHubConfig,
  packStateCookie,
  unpackAndVerifyState,
  exchangeCodeForToken,
  fetchGitHubUserInfo,
} from "../../utils/oauthUtils.ts";
import { AuthUserData } from "../authService/authTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";
import crypto from "node:crypto";
import { config } from "../../config.ts";

const IS_PROD = config.server.env === "production";

export const oauthController = {
  // Step 1: Redirect to GitHub
  initiateGitHub: async (request: FastifyRequest, reply: FastifyReply) => {
    const errors = requestErrors(request);
    const githubConfig = getGitHubConfig();

    if (!githubConfig.clientId || !githubConfig.clientSecret) {
      throw errors.internal("GitHub OAuth not configured", {
        hasClientId: !!githubConfig.clientId,
        hasClientSecret: !!githubConfig.clientSecret,
      });
    }

    const state = crypto.randomUUID();
    const authUrl =
      `${githubConfig.authUrl}?client_id=${githubConfig.clientId}` +
      `&redirect_uri=${encodeURIComponent(githubConfig.redirectUri)}` +
      `&scope=${encodeURIComponent("user:email")}` +
      `&state=${encodeURIComponent(state)}`;

    // Store signed state in cookie
    reply.setCookie("oauth_state", packStateCookie(state), {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
      path: config.routes.oauth,
      maxAge: 10 * 60, // 10 minutes
    });

    return ApiResponseHelper.success({ redirectUrl: authUrl }, "GitHub OAuth redirect created");
  },

  // Step 2: Handle GitHub callback
  handleGitHubCallback: async (
    request: FastifyRequest<{ Querystring: { code: string; state: string } }>,
    reply: FastifyReply
  ): Promise<ApiResponse<AuthUserData>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { code, state } = request.query;

    if (!code || !state) {
      throw errors.validation("Missing code or state parameter", {
        hasCode: !!code,
        hasState: !!state,
      });
    }

    // Verify state (CSRF protection)
    const cookieState = unpackAndVerifyState(request.cookies.oauth_state);
    if (!cookieState || cookieState !== state) {
      throw errors.validation("Invalid state parameter", {
        hasCookieState: !!cookieState,
        stateMatch: cookieState === state,
      });
    }

    // Clear state cookie
    reply.clearCookie("oauth_state", { path: config.routes.oauth });

    // Exchange code for token and fetch user info
    const githubConfig = getGitHubConfig();
    const tokenData = await exchangeCodeForToken(githubConfig, code);
    const userInfo = await fetchGitHubUserInfo(tokenData.access_token);

    const user = await db.transaction(async (tx) => {
      const usr = await tx.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE oauth_provider = ? AND oauth_id = ?",
        ["github", userInfo.id]
      );

      // If OAuth user exists, ensure they have an avatar
      if (usr) {
        const existingAvatar = await tx.get<{ id: number }>(
          "SELECT id FROM avatars WHERE user_id = ?",
          [usr.id]
        );

        // OAuth avatar URL from GitHub - just store it (no filesystem operation)
        if (userInfo.avatar_url) {
          if (existingAvatar) {
            await tx.run(
              "UPDATE avatars SET file_url = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
              [userInfo.avatar_url, userInfo.avatar_url, usr.id]
            );
          } else {
            await tx.run(
              "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
              [usr.id, userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0]
            );
          }
        }
        // Note: If no OAuth avatar and no existing avatar, handle after transaction
        return usr;
      }

      // If not found, try to link by email or create new
      const existingByEmail = await tx.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE email = ?",
        [userInfo.email]
      );

      if (existingByEmail) {
        await tx.run("UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?", [
          "github",
          userInfo.id,
          existingByEmail.id,
        ]);

        const existingAvatar = await tx.get<{ id: number }>(
          "SELECT id FROM avatars WHERE user_id = ?",
          [existingByEmail.id]
        );

        // OAuth avatar URL from GitHub - just store it (no filesystem operation)
        if (userInfo.avatar_url) {
          if (existingAvatar) {
            await tx.run(
              "UPDATE avatars SET file_url = ?, file_path = ?, file_name = ?, mime_type = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
              [
                userInfo.avatar_url,
                userInfo.avatar_url,
                "oauth_avatar",
                "image/jpeg",
                0,
                existingByEmail.id,
              ]
            );
          } else {
            await tx.run(
              "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
              [
                existingByEmail.id,
                userInfo.avatar_url,
                userInfo.avatar_url,
                "oauth_avatar",
                "image/jpeg",
                0,
              ]
            );
          }
        }
        // Note: If no OAuth avatar and no existing avatar, handle after transaction
        return existingByEmail;
      }

      // Create new user
      const result = await tx.run(
        "INSERT INTO users (username, email, oauth_provider, oauth_id) VALUES (?, ?, ?, ?)",
        [userInfo.name, userInfo.email, "github", userInfo.id]
      );

      // OAuth avatar URL from GitHub - just store it (no filesystem operation)
      if (userInfo.avatar_url) {
        await tx.run(
          "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
          [result.lastID, userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0]
        );
      }
      // Note: If no OAuth avatar, handle default avatar after transaction

      return {
        id: result.lastID,
        username: userInfo.name,
        email: userInfo.email,
        created_at: new Date().toISOString(),
        avatar_url: "",
      };
    });

    if (!user) {
      throw errors.internal("Failed to create or retrieve user during OAuth flow", {
        provider: "github",
        githubId: userInfo.id,
        email: userInfo.email,
      });
    }

    // Post-transaction: Add default avatar if user has none
    // Concept: Filesystem operations outside DB transaction (can't be rolled back by DB)
    // Non-critical operation - if it fails, user can still log in
    if (!userInfo.avatar_url) {
      const existingAvatar = await db.get<{ id: number }>(
        "SELECT id FROM avatars WHERE user_id = ?",
        [user.id]
      );

      if (!existingAvatar) {
        try {
          const { copyDefaultAvatar } = await import("../../utils/uploadUtils.ts");
          const defaultAvatar = await copyDefaultAvatar(user.id);
          await db.run(
            "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [
              user.id,
              defaultAvatar.fileUrl,
              defaultAvatar.filePath,
              defaultAvatar.fileName,
              defaultAvatar.mimeType,
              defaultAvatar.fileSize,
            ]
          );
        } catch (err) {
          // Non-critical failure - user can still log in without avatar
          request.log.warn(
            { userId: user.id, error: err },
            "Failed to copy default avatar for OAuth user"
          );
        }
      }
    }

    // Issue JWT tokens (same as regular login)
    const accessToken = await signAccessToken(user.id);
    const refreshToken = await generateAndStoreRefreshToken(db, user.id);
    setRefreshTokenCookie(reply, refreshToken);

    // Set user as online immediately after successful OAuth login
    const now = new Date().toISOString();
    await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [now, user.id]);

    // Retrieve avatar URL using helper (throws error if not found)
    const avatar_url = await getAvatarUrl(db, user.id);

    return ApiResponseHelper.success(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        avatar_url,
        tokens: { accessToken },
      },
      "GitHub OAuth login successful"
    );
  },
};
