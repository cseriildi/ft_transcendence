import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { FastifyInstance } from "fastify";
import { createTestApp, cleanupTestApp, resetDatabase } from "./setup";
import { config } from "../src/config";
import * as speakeasy from "speakeasy";
import { DatabaseHelper } from "../src/utils/databaseUtils";

describe("2FA Routes", () => {
  let app: FastifyInstance;
  const AUTH_PREFIX = config.routes.auth;
  const API_PREFIX = config.routes.api;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  /**
   * Helper: Register and login a user, returning tokens and userId
   */
  async function registerAndLogin() {
    const payload = {
      username: "testuser",
      email: "test@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };

    const registerRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload,
    });
    const registerBody = registerRes.json() as any;
    const userId = registerBody.data?.id;
    const accessToken = registerBody.data?.tokens?.accessToken;

    return { userId, accessToken, payload };
  }

  /**
   * Helper: Get the 2FA secret from the database for a user
   */
  async function get2FASecret(userId: number): Promise<string | null> {
    const db = new DatabaseHelper(app.db);
    const result = await db.get<{ twofa_secret: string | null }>(
      "SELECT twofa_secret FROM users WHERE id = ?",
      [userId]
    );
    return result?.twofa_secret || null;
  }

  /**
   * Helper: Check if 2FA is enabled for a user
   */
  async function is2FAEnabled(userId: number): Promise<boolean> {
    const db = new DatabaseHelper(app.db);
    const result = await db.get<{ twofa_enabled: number }>(
      "SELECT twofa_enabled FROM users WHERE id = ?",
      [userId]
    );
    return result?.twofa_enabled === 1;
  }

  // =========== 2FA SETUP TESTS ===========

  it("POST /api/users/:userId/2fa/setup should generate 2FA secret and QR code", async () => {
    const { userId, accessToken } = await registerAndLogin();

    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.secret).toBeDefined();
    expect(body.data?.qrcode).toBeDefined();
    expect(body.data?.qrcode).toContain("data:image/png;base64,");

    // Verify secret is stored in database (but 2FA not enabled yet)
    const secret = await get2FASecret(userId);
    expect(secret).toBeDefined();
    expect(secret).not.toBeNull();

    const enabled = await is2FAEnabled(userId);
    expect(enabled).toBe(false);
  });

  it("POST /api/users/:userId/2fa/setup should require authentication", async () => {
    const { userId } = await registerAndLogin();

    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      // No authorization header
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Access token required");
  });

  it("POST /api/users/:userId/2fa/setup should reject access to other user's 2FA", async () => {
    const { accessToken } = await registerAndLogin();

    // Try to setup 2FA for user ID 999 (doesn't exist/not our user)
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/999/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("not authorized");
  });

  it("POST /api/users/:userId/2fa/setup should allow regenerating secret", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // First setup
    const res1 = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const body1 = res1.json() as any;
    const secret1 = body1.data?.secret;

    // Second setup (should generate new secret)
    const res2 = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const body2 = res2.json() as any;
    const secret2 = body2.data?.secret;

    expect(secret1).not.toBe(secret2);
  });

  // =========== 2FA ENABLE TESTS ===========

  it("POST /api/users/:userId/2fa/enable should enable 2FA with valid token", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const setupBody = setupRes.json() as any;
    const secret = setupBody.data?.secret;

    // Generate valid TOTP token
    const token = speakeasy.totp({
      secret,
      encoding: "base32",
    });

    // Enable 2FA
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.message).toContain("2FA enabled");

    // Verify 2FA is enabled in database
    const enabled = await is2FAEnabled(userId);
    expect(enabled).toBe(true);
  });

  it("POST /api/users/:userId/2fa/enable should reject invalid token", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup 2FA
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    // Try to enable with invalid token
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: "000000" }, // Invalid token
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid");

    // Verify 2FA is NOT enabled
    const enabled = await is2FAEnabled(userId);
    expect(enabled).toBe(false);
  });

  it("POST /api/users/:userId/2fa/enable should reject without setup first", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Try to enable 2FA without calling setup first
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: "123456" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("not set up");
  });

  it("POST /api/users/:userId/2fa/enable should require authentication", async () => {
    const { userId } = await registerAndLogin();

    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      payload: { token: "123456" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  // =========== 2FA VERIFY TESTS ===========

  it("POST /api/users/:userId/2fa/verify should verify valid token when 2FA enabled", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Now verify a new token
    const verifyToken = speakeasy.totp({ secret, encoding: "base32" });
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/verify`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: verifyToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.message).toContain("valid");
  });

  it("POST /api/users/:userId/2fa/verify should reject invalid token", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Try to verify with invalid token
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/verify`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: "000000" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /api/users/:userId/2fa/verify should reject if 2FA not enabled", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup 2FA but don't enable it
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    // Try to verify without enabling
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/verify`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: "123456" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("not enabled");
  });

  // =========== 2FA DISABLE TESTS ===========

  it("POST /api/users/:userId/2fa/disable should disable 2FA with valid token", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Verify it's enabled
    let enabled = await is2FAEnabled(userId);
    expect(enabled).toBe(true);

    // Now disable 2FA
    const disableToken = speakeasy.totp({ secret, encoding: "base32" });
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/disable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: disableToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.message).toContain("disabled");

    // Verify it's disabled
    enabled = await is2FAEnabled(userId);
    expect(enabled).toBe(false);
  });

  it("POST /api/users/:userId/2fa/disable should reject invalid token", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Try to disable with invalid token
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/disable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: "000000" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);

    // Verify it's still enabled
    const enabled = await is2FAEnabled(userId);
    expect(enabled).toBe(true);
  });

  it("POST /api/users/:userId/2fa/disable should reject if 2FA not enabled", async () => {
    const { userId, accessToken } = await registerAndLogin();

    // Try to disable 2FA when it's not even enabled
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/disable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: "123456" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("not enabled");
  });

  // =========== 2FA LOGIN FLOW TESTS ===========

  it("POST /auth/login should return tempToken when 2FA is enabled", async () => {
    const { userId, accessToken, payload } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Now try to login - should get tempToken instead of accessToken
    const loginRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: payload.email,
        password: payload.password,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json() as any;
    expect(loginBody.success).toBe(true);
    expect(loginBody.data?.requires2fa).toBe(true);
    expect(loginBody.data?.tempToken).toBeDefined();
    expect(loginBody.data?.tokens).toBeUndefined(); // Should NOT have access tokens yet
    expect(loginBody.message).toContain("2FA verification required");
  });

  it("POST /auth/login/2fa should issue tokens with valid tempToken and 2FA code", async () => {
    const { userId, accessToken, payload } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Login to get tempToken
    const loginRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: payload.email,
        password: payload.password,
      },
    });
    const tempToken = loginRes.json().data?.tempToken;

    // Complete 2FA login
    const twofaToken = speakeasy.totp({ secret, encoding: "base32" });
    const login2faRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login/2fa`,
      payload: {
        tempToken,
        twofa_token: twofaToken,
      },
    });

    expect(login2faRes.statusCode).toBe(200);
    const login2faBody = login2faRes.json() as any;
    expect(login2faBody.success).toBe(true);
    expect(login2faBody.data?.tokens?.accessToken).toBeDefined();
    expect(login2faBody.data?.email).toBe(payload.email);
    expect(login2faBody.data?.username).toBe(payload.username);

    // Should have refresh token cookie
    const refreshCookie = login2faRes.cookies.find((c: any) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();
  });

  it("POST /auth/login/2fa should reject invalid 2FA token", async () => {
    const { userId, accessToken, payload } = await registerAndLogin();

    // Setup and enable 2FA
    const setupRes = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/setup`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const secret = setupRes.json().data?.secret;

    const enableToken = speakeasy.totp({ secret, encoding: "base32" });
    await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/${userId}/2fa/enable`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: { token: enableToken },
    });

    // Login to get tempToken
    const loginRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: payload.email,
        password: payload.password,
      },
    });
    const tempToken = loginRes.json().data?.tempToken;

    // Try 2FA login with invalid token
    const login2faRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login/2fa`,
      payload: {
        tempToken,
        twofa_token: "000000", // Invalid
      },
    });

    expect(login2faRes.statusCode).toBe(401);
    const login2faBody = login2faRes.json() as any;
    expect(login2faBody.success).toBe(false);
    expect(login2faBody.message).toContain("Invalid");
  });

  it("POST /auth/login/2fa should reject invalid tempToken", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login/2fa`,
      payload: {
        tempToken: "invalid-temp-token",
        twofa_token: "123456",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid");
  });

  it("POST /auth/login/2fa should reject missing tempToken", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login/2fa`,
      payload: {
        twofa_token: "123456",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/login/2fa should reject missing 2FA token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login/2fa`,
      payload: {
        tempToken: "some-token",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/login should work normally when 2FA is not enabled", async () => {
    const { payload } = await registerAndLogin();

    // Login without 2FA enabled - should work normally
    const loginRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: payload.email,
        password: payload.password,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json() as any;
    expect(loginBody.success).toBe(true);
    expect(loginBody.data?.requires2fa).toBeUndefined();
    expect(loginBody.data?.tempToken).toBeUndefined();
    expect(loginBody.data?.tokens?.accessToken).toBeDefined(); // Should have normal tokens

    // Should have refresh token cookie
    const refreshCookie = loginRes.cookies.find((c: any) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();
  });

  // =========== TOKEN TYPE VALIDATION TESTS ===========

  it("Should reject using access token as tempToken in /auth/login/2fa", async () => {
    const { accessToken } = await registerAndLogin();

    // Try to use access token as tempToken (should fail type validation)
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login/2fa`,
      payload: {
        tempToken: accessToken, // Wrong token type
        twofa_token: "123456",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid");
  });
});
