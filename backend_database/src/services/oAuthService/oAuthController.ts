import { createHandler } from "../../utils/handlerUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import { signAccessToken, signRefreshToken, createJti } from "../../utils/authUtils.ts";
import {
  getGitHubConfig,
  packStateCookie,
  unpackAndVerifyState,
  exchangeCodeForToken,
  fetchGitHubUserInfo,
} from "../../utils/oauthUtils.ts";
import { UserLoginResponse } from "../authService/authTypes.ts";
import { User } from "../userService/userTypes.ts";
import bcrypt from "bcrypt";
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
    UserLoginResponse
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

    // If OAuth user exists, update their avatar if provided
    if (user && userInfo.avatar_url) {
      const existingAvatar = await db.get<{ id: number }>(
        "SELECT id FROM avatars WHERE user_id = ?",
        [user.id]
      );

      if (existingAvatar) {
        // Update existing avatar with latest OAuth URL
        await db.run(
          "UPDATE avatars SET file_url = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
          [userInfo.avatar_url, userInfo.avatar_url, user.id]
        );
      } else {
        // Insert new avatar record
        await db.run(
          "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
          [user.id, userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0]
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
        await db.run(
          "UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?",
          ["github", userInfo.id, existingByEmail.id]
        );
        user = existingByEmail;

        // Handle OAuth avatar - update or insert into avatars table
        if (userInfo.avatar_url) {
          const existingAvatar = await db.get<{ id: number }>(
            "SELECT id FROM avatars WHERE user_id = ?",
            [existingByEmail.id]
          );

          if (existingAvatar) {
            // Update existing avatar with OAuth URL
            await db.run(
              "UPDATE avatars SET file_url = ?, file_path = ?, file_name = ?, mime_type = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
              [userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0, existingByEmail.id]
            );
          } else {
            // Insert new avatar record
            await db.run(
              "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
              [existingByEmail.id, userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0]
            );
          }
        }
      } else {
        // Create new user
        const result = await db.run(
          "INSERT INTO users (username, email, oauth_provider, oauth_id) VALUES (?, ?, ?, ?)",
          [userInfo.name, userInfo.email, "github", userInfo.id]
        );

        user = {
          id: result.lastID,
          username: userInfo.name,
          email: userInfo.email,
          created_at: new Date().toISOString(),
        };

        // Save OAuth avatar to avatars table
        if (userInfo.avatar_url) {
          await db.run(
            "INSERT INTO avatars (user_id, file_url, file_path, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [result.lastID, userInfo.avatar_url, userInfo.avatar_url, "oauth_avatar", "image/jpeg", 0]
          );
        }
      }
    }

    // Issue JWT tokens (same as regular login)
    const accessToken = await signAccessToken(user.id);
    const jti = createJti();
    const refreshToken = await signRefreshToken(user.id, jti);
    const refreshHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      "INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [jti, user.id, refreshHash, expiresAt]
    );

    // Set refresh token cookie
    reply.setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
      path: "/auth",
      maxAge: 7 * 24 * 60 * 60,
    });

    return ApiResponseHelper.success(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        tokens: { accessToken },
      },
      "GitHub OAuth login successful"
    );
  }),
};
