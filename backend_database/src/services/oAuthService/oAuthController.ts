import { createHandler } from "../../utils/handlerUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import {
  signAccessToken,
  setRefreshTokenCookie,
  generateAndStoreRefreshToken,
} from "../../utils/authUtils.ts";
import { copyDefaultAvatar } from "../../utils/uploadUtils.ts";
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
  initiateGitHub: createHandler(async (request, context) => {
    const { reply } = context;
    const githubConfig = getGitHubConfig();

    if (!githubConfig.clientId || !githubConfig.clientSecret) {
      throw errors.internal("GitHub OAuth not configured");
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
  }),

  // Step 2: Handle GitHub callback
  handleGitHubCallback: createHandler<
    { Querystring: { code: string; state: string } },
    ApiResponse<AuthUserData>
  >(async (request, context) => {
    const { code, state } = request.query;
    const { db, reply } = context;

    if (!code || !state) {
      throw errors.validation("Missing code or state parameter");
    }

    // Verify state (CSRF protection)
    const cookieState = unpackAndVerifyState(request.cookies.oauth_state);
    if (!cookieState || cookieState !== state) {
      throw errors.validation("Invalid state parameter");
    }

    // Clear state cookie
    reply.clearCookie("oauth_state", { path: config.routes.oauth });

    // Exchange code for token and fetch user info
    const githubConfig = getGitHubConfig();
    const tokenData = await exchangeCodeForToken(githubConfig, code);
    const userInfo = await fetchGitHubUserInfo(tokenData.access_token);

    // Find existing user by OAuth provider+id
    let user = await db.get<User>(
      "SELECT id, username, email, created_at FROM users WHERE oauth_provider = ? AND oauth_id = ?",
      ["github", userInfo.id]
    );

    // If OAuth user exists, ensure they have an avatar
    if (user) {
      const existingAvatar = await db.get<{ id: number }>(
        "SELECT id FROM avatars WHERE user_id = ?",
        [user.id]
      );

      if (userInfo.avatar_url) {
        // Update with OAuth avatar
        if (existingAvatar) {
          await db.run(
            "UPDATE avatars SET file_url = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            [userInfo.avatar_url, userInfo.avatar_url, user.id]
          );
        } else {
          await db.run(
            "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0]
          );
        }
      } else if (!existingAvatar) {
        // OAuth didn't provide avatar and user has none - use default
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
      }
    }

    // If not found, try to link by email or create new
    if (!user) {
      const existingByEmail = await db.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE email = ?",
        [userInfo.email]
      );

      if (existingByEmail) {
        // Link OAuth to existing account
        await db.run("UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?", [
          "github",
          userInfo.id,
          existingByEmail.id,
        ]);
        user = existingByEmail;

        // Handle OAuth avatar - ensure user has an avatar
        const existingAvatar = await db.get<{ id: number }>(
          "SELECT id FROM avatars WHERE user_id = ?",
          [existingByEmail.id]
        );

        if (userInfo.avatar_url) {
          // Update with OAuth avatar
          if (existingAvatar) {
            await db.run(
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
            await db.run(
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
        } else if (!existingAvatar) {
          // OAuth didn't provide avatar and user has none - use default
          const defaultAvatar = await copyDefaultAvatar(existingByEmail.id);
          await db.run(
            "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [
              existingByEmail.id,
              defaultAvatar.fileUrl,
              defaultAvatar.filePath,
              defaultAvatar.fileName,
              defaultAvatar.mimeType,
              defaultAvatar.fileSize,
            ]
          );
        }
      } else {
        // Create new user
        const result = await db.run(
          "INSERT INTO users (username, email, oauth_provider, oauth_id) VALUES (?, ?, ?, ?)",
          [userInfo.name, userInfo.email, "github", userInfo.id]
        );

        // Save avatar to avatars table (OAuth or default)
        if (userInfo.avatar_url) {
          await db.run(
            "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [
              result.lastID,
              userInfo.avatar_url,
              userInfo.avatar_url,
              "oauth_avatar",
              "image/jpeg",
              0,
            ]
          );
        } else {
          // OAuth didn't provide avatar - use default
          const defaultAvatar = await copyDefaultAvatar(result.lastID);
          await db.run(
            "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [
              result.lastID,
              defaultAvatar.fileUrl,
              defaultAvatar.filePath,
              defaultAvatar.fileName,
              defaultAvatar.mimeType,
              defaultAvatar.fileSize,
            ]
          );
        }

        user = {
          id: result.lastID,
          username: userInfo.name,
          email: userInfo.email,
          created_at: new Date().toISOString(),
          avatar_url: "", // Will be fetched later using helper
        };
      }
    }

    // At this point, user should always be defined
    if (!user) {
      throw errors.internal("Failed to create or retrieve user during OAuth flow");
    }

    // Issue JWT tokens (same as regular login)
    const accessToken = await signAccessToken(user.id);
    const refreshToken = await generateAndStoreRefreshToken(db, user.id);
    setRefreshTokenCookie(reply, refreshToken);

    // Retrieve avatar URL using helper (throws error if not found)
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
      "GitHub OAuth login successful"
    );
  }),
};
