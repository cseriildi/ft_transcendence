import { createHandler } from "../../utils/handlerUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import { signAccessToken, signRefreshToken, createJti } from "../../utils/authutils.ts";
import { UserLoginResponse } from "../authService/authTypes.ts";
import { User } from "../userService/userTypes.ts";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

// OAuth Provider Configuration
interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

// OAuth Provider Configurations
const getOAuthProvider = (provider: string): OAuthProvider => {
  const providers: Record<string, OAuthProvider> = {
    github: {
      name: "GitHub",
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      redirectUri: process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/auth/github/callback",
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user"
    },
    google: {
      name: "Google",
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/google/callback",
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo"
    }
  };

  const config = providers[provider.toLowerCase()];
  if (!config) {
    throw errors.badRequest(`Unsupported OAuth provider: ${provider}`);
  }

  if (!config.clientId || !config.clientSecret) {
    throw errors.internal(`OAuth provider ${provider} not configured`);
  }

  return config;
};

// Exchange OAuth code for access token
const exchangeCodeForToken = async (provider: string, code: string): Promise<OAuthTokenResponse> => {
  const oauthProvider = getOAuthProvider(provider);
  
  const response = await fetch(oauthProvider.tokenUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: oauthProvider.clientId,
      client_secret: oauthProvider.clientSecret,
      code,
      redirect_uri: oauthProvider.redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw errors.badRequest("Failed to exchange OAuth code for token");
  }

  const tokenData = await response.json() as OAuthTokenResponse;
  
  if (!tokenData.access_token) {
    throw errors.badRequest("Invalid token response from OAuth provider");
  }

  return tokenData;
};

// Fetch user info from OAuth provider
const fetchUserInfo = async (provider: string, accessToken: string): Promise<OAuthUserInfo> => {
  const oauthProvider = getOAuthProvider(provider);
  
  const response = await fetch(oauthProvider.userInfoUrl, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    }
  });

  if (!response.ok) {
    throw errors.badRequest("Failed to fetch user info from OAuth provider");
  }

  const userInfo = await response.json();

  // Normalize user info based on provider
  let normalizedInfo: OAuthUserInfo;
  
  if (provider.toLowerCase() === "github") {
    normalizedInfo = {
      id: String(userInfo.id),
      email: userInfo.email,
      name: userInfo.name || userInfo.login,
      avatar_url: userInfo.avatar_url
    };
  } else if (provider.toLowerCase() === "google") {
    normalizedInfo = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      avatar_url: userInfo.picture
    };
  } else {
    throw errors.badRequest(`Unsupported provider: ${provider}`);
  }

  if (!normalizedInfo.email) {
    throw errors.badRequest("Email not provided by OAuth provider");
  }

  return normalizedInfo;
};

export const oauthController = {
  // Step 1: Redirect to OAuth provider
  initiateAuth: createHandler<{ Params: { provider: string } }, { redirectUrl: string }>(
    async (request, context) => {
      const { provider } = request.params;
      const oauthProvider = getOAuthProvider(provider);
      
      const state = crypto.randomUUID();
      
      // Build scope based on provider
      let scope = "";
      if (provider.toLowerCase() === "github") {
        scope = "user:email";
      } else if (provider.toLowerCase() === "google") {
        scope = "openid email profile";
      }
      
      const authUrl = `${oauthProvider.authUrl}?` +
        `client_id=${oauthProvider.clientId}&` +
        `redirect_uri=${encodeURIComponent(oauthProvider.redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}`;
      
      // TODO: Store state in session/redis for security validation
      // For now, we'll skip state validation but it should be implemented
      
      return ApiResponseHelper.success({ redirectUrl: authUrl });
    }
  ),

  // Step 2: Handle OAuth callback
  handleCallback: createHandler<{ 
    Params: { provider: string };
    Querystring: { code: string; state?: string };
  }, UserLoginResponse>(
    async (request, context) => {
      const { provider } = request.params;
      const { code, state } = request.query;
      const { db, reply } = context;
      
      if (!code) {
        throw errors.badRequest("Authorization code not provided");
      }
      
      // TODO: Verify state parameter for CSRF protection
      // if (!state || !isValidState(state)) {
      //   throw errors.badRequest("Invalid state parameter");
      // }
      
      // Exchange code for access token
      const tokenResponse = await exchangeCodeForToken(provider, code);
      
      // Get user info from OAuth provider
      const userInfo = await fetchUserInfo(provider, tokenResponse.access_token);
      
      // Find or create user using promisified pattern
      let user = await new Promise<User | null>((resolve, reject) => {
        db.get(
          "SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?",
          [provider.toLowerCase(), userInfo.id],
          (err, row) => {
            if (err) reject(errors.internal("Database error"));
            else resolve(row || null);
          }
        );
      });
      
      if (!user) {
        // Create new OAuth user
        const result = await new Promise<{ lastID: number }>((resolve, reject) => {
          db.run(
            "INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url) VALUES (?, ?, ?, ?, ?)",
            [userInfo.name, userInfo.email, provider.toLowerCase(), userInfo.id, userInfo.avatar_url || null],
            function(err) {
              if (err) reject(errors.conflict("User with this email may already exist"));
              else resolve({ lastID: this.lastID });
            }
          );
        });

        user = {
          id: result.lastID,
          username: userInfo.name,
          email: userInfo.email,
          created_at: new Date().toISOString()
        };
      }
      
      // Generate internal JWT tokens
      const accessToken = await signAccessToken(user.id);
      const jti = createJti();
      const refreshToken = await signRefreshToken(user.id, jti);
      
      // Store refresh token using existing pattern
      const refreshHash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(
          "INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
          [jti, user.id, refreshHash, expiresAt],
          (err) => {
            if (err) reject(errors.internal("Failed to store refresh token"));
            else resolve();
          }
        );
      });

      // Set refresh token cookie
      reply.setCookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/auth",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      return ApiResponseHelper.success({
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        tokens: { accessToken }
      }, `OAuth login successful via ${provider}`);
    }
  )
};