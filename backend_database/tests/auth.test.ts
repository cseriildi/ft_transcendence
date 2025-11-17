import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { FastifyInstance } from "fastify";
import { createTestApp, cleanupTestApp, resetDatabase } from "./setup";
import { config } from "../src/config";

describe("Auth Routes", () => {
  let app: FastifyInstance;
  const AUTH_PREFIX = config.routes.auth;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  it("POST /auth/register should create a user", async () => {
    const payload = {
      username: "testuser",
      email: "test@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    const res = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    expect(res.statusCode).toBe(201);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.username).toBe(payload.username);
    expect(body.data?.email).toBe(payload.email);
    // Registration does not return avatar_url (not part of AuthUserData)
    expect(body.data?.tokens?.accessToken).toBeDefined();
  });

  it("POST /auth/register should reject duplicate email", async () => {
    const payload = {
      username: "user1",
      email: "dup@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: { ...payload, username: "user2" },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/login should authenticate valid user", async () => {
    const payload = {
      username: "userlogin",
      email: "login@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });

    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: { email: payload.email, password: payload.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.email).toBe(payload.email);
    expect(body.data?.username).toBe(payload.username);
    expect(body.data?.tokens?.accessToken).toBeDefined();
  });

  it("POST /login should reject wrong password", async () => {
    const payload = {
      username: "userlogin2",
      email: "login2@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });

    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: { email: payload.email, password: "wrongpass123" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /login should return access token and set refresh cookie", async () => {
    const payload = {
      username: "tokenuser",
      email: "token@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });

    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: { email: payload.email, password: payload.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.tokens?.accessToken).toBeDefined();

    // Check for refresh_token cookie
    const cookies = res.cookies;
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c: any) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
  });

  it("POST /refresh should rotate tokens with valid refresh cookie", async () => {
    const payload = {
      username: "refreshuser",
      email: "refresh@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    const loginRes = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    const refreshCookie = loginRes.cookies.find((c: any) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();

    // Use refresh token
    const refreshRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: refreshCookie!.value },
    });
    expect(refreshRes.statusCode).toBe(200);
    const body = refreshRes.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.tokens?.accessToken).toBeDefined();

    // Should get new refresh token
    const newRefreshCookie = refreshRes.cookies.find((c: any) => c.name === "refresh_token");
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie?.value).not.toBe(refreshCookie!.value);
  });

  it("POST /refresh should reject without refresh cookie", async () => {
    const res = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/refresh` });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /logout should revoke refresh token and clear cookie", async () => {
    const payload = {
      username: "logoutuser",
      email: "logout@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    const loginRes = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    const refreshCookie = loginRes.cookies.find((c: any) => c.name === "refresh_token");
    expect(refreshCookie).toBeDefined();

    // Logout
    const logoutRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/logout`,
      cookies: { refresh_token: refreshCookie!.value },
    });
    expect(logoutRes.statusCode).toBe(200);
    const body = logoutRes.json() as any;
    expect(body.success).toBe(true);

    // Try to use the same refresh token - should fail
    const refreshRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: refreshCookie!.value },
    });
    expect(refreshRes.statusCode).toBe(401);
  });

  it("POST /logout should fail without refresh cookie", async () => {
    const res = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/logout` });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  // =========== REGISTRATION VALIDATION TESTS ===========

  it("POST /auth/register should reject duplicate username", async () => {
    const payload = {
      username: "sameuser",
      email: "user1@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });

    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: { ...payload, email: "different@example.com" },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("already exist");
  });

  it("POST /auth/register should reject password mismatch", async () => {
    const payload = {
      username: "mismatchuser",
      email: "mismatch@example.com",
      password: "securepassword123",
      confirmPassword: "differentpassword123",
    };
    const res = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Passwords do not match");
  });

  it("POST /auth/register should reject weak password", async () => {
    // In test environment, minimum is 1 character, so empty password should fail
    // In production, password must be 10+ chars with number
    const payload = {
      username: "weakuser",
      email: "weak@example.com",
      password: "", // Empty password fails in all environments
      confirmPassword: "",
    };
    const res = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/register should reject invalid email format", async () => {
    const payload = {
      username: "invalidemailuser",
      email: "not-an-email",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    const res = await app.inject({ method: "POST", url: `${AUTH_PREFIX}/register`, payload });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/register should reject missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: { username: "test" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/register should reject invalid username format", async () => {
    const invalidUsernames = ["a", "user@name", "user name", "a".repeat(51)];

    for (const username of invalidUsernames) {
      const res = await app.inject({
        method: "POST",
        url: `${AUTH_PREFIX}/register`,
        payload: {
          username,
          email: `${username.substring(0, 5)}@example.com`,
          password: "securepassword123",
          confirmPassword: "securepassword123",
        },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    }
  });

  // =========== LOGIN VALIDATION TESTS ===========

  it("POST /auth/login should reject non-existent email", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: "nonexistent@example.com",
        password: "password123",
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid email");
  });

  it("POST /auth/login should reject missing email", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: { password: "password123" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/login should reject missing password", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: { email: "test@example.com" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /auth/login should reject invalid email format", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: "not-an-email",
        password: "password123",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  // =========== TOKEN VERIFY TESTS ===========

  it("GET /auth/verify should verify valid access token", async () => {
    const payload = {
      username: "verifyuser",
      email: "verify@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    const registerRes = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload,
    });
    const registerBody = registerRes.json() as any;
    expect(registerBody.success).toBe(true);
    const accessToken = registerBody.data?.tokens?.accessToken;

    const res = await app.inject({
      method: "GET",
      url: `${AUTH_PREFIX}/verify`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.verified).toBe(true);
  });

  it("GET /auth/verify should reject without access token", async () => {
    const res = await app.inject({ method: "GET", url: `${AUTH_PREFIX}/verify` });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Access token required");
  });

  it("GET /auth/verify should reject invalid access token", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${AUTH_PREFIX}/verify`,
      headers: {
        authorization: "Bearer invalid-token-here",
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("GET /auth/verify should reject malformed authorization header", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${AUTH_PREFIX}/verify`,
      headers: {
        authorization: "InvalidFormat token",
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  // =========== REFRESH TOKEN EDGE CASES ===========

  it("POST /refresh should reject with invalid refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: "invalid-token-value" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /refresh should reject with malformed refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: "not.a.jwt" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });
});
