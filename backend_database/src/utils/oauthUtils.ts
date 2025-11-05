import crypto from "node:crypto";
import { errors } from "./errorUtils.ts";
import {
  OAuthProvider,
  OAuthTokenResponse,
  OAuthUserInfo,
} from "../services/oAuthService/oAuthTypes.ts";
import { config } from "../config.ts";

// CSRF state protection
const STATE_SECRET = config.oauth.stateSecret;

// OAuth provider configurations
export function getGitHubConfig(): OAuthProvider {
  return {
    name: "GitHub",
    clientId: config.oauth.github.clientId,
    clientSecret: config.oauth.github.clientSecret,
    redirectUri: config.oauth.github.redirectUri,
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
  };
}

// State signing and verification helpers
export function signState(value: string): string {
  return crypto.createHmac("sha256", STATE_SECRET).update(value).digest("hex");
}

export function packStateCookie(value: string): string {
  return `${value}.${signState(value)}`;
}

export function unpackAndVerifyState(cookieVal: string | undefined): string | null {
  if (!cookieVal) return null;
  const idx = cookieVal.lastIndexOf(".");
  if (idx <= 0) return null;
  const val = cookieVal.slice(0, idx);
  const sig = cookieVal.slice(idx + 1);
  return signState(val) === sig ? val : null;
}

// Exchange OAuth code for access token
export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code,
    redirect_uri: provider.redirectUri,
  });

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw errors.validation("Failed to exchange code for token", {
      status: res.status,
      statusText: res.statusText,
      provider: "github",
      function: "exchangeCodeForToken",
    });
  }

  const data = (await res.json()) as OAuthTokenResponse;
  if (!data.access_token) {
    throw errors.validation("Invalid token response from OAuth provider", {
      hasAccessToken: !!data.access_token,
      provider: "github",
      function: "exchangeCodeForToken",
    });
  }

  return data;
}

// Fetch GitHub user info with email fallback
export async function fetchGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "ping-pong-api",
  };

  // Get user profile
  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) {
    throw errors.validation("Failed to fetch user info from GitHub", {
      status: userRes.status,
      statusText: userRes.statusText,
      function: "fetchGitHubUserInfo",
    });
  }
  const user = await userRes.json();

  // Get email (might be private)
  let email: string | null = user.email;
  if (!email) {
    const emailRes = await fetch("https://api.github.com/user/emails", { headers });
    if (emailRes.ok) {
      const emails = await emailRes.json();
      const primaryEmail =
        emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified);
      email = primaryEmail?.email || null;
    }
  }

  if (!email) {
    throw errors.validation("Email not available from GitHub", {
      githubId: user.id,
      githubLogin: user.login,
      function: "fetchGitHubUserInfo",
    });
  }

  return {
    id: String(user.id),
    email,
    name: user.name || user.login,
    avatar_url: user.avatar_url,
  };
}
