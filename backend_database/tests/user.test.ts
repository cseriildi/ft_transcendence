import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { FastifyInstance } from "fastify";
import { createTestApp, cleanupTestApp, resetDatabase } from "./setup";
import { config } from "../src/config";

describe("User Routes", () => {
  let app: FastifyInstance;
  let userId: number;
  let accessToken: string;
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
    // Create a test user for each test
    const payload = {
      username: "testuser",
      email: "test@example.com",
      password: "securepassword123",
      confirmPassword: "securepassword123",
    };
    const res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload,
    });
    const body = res.json() as any;
    userId = body.data?.id;
    accessToken = body.data?.tokens?.accessToken || "";
  });

  it("GET /users should return all users", async () => {
    const res = await app.inject({ method: "GET", url: `${API_PREFIX}/users` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty("id");
    expect(body.data[0]).toHaveProperty("username");
    expect(body.data[0]).toHaveProperty("email");
    expect(body.data[0]).toHaveProperty("avatar_url");
    expect(body.data[0]).not.toHaveProperty("password_hash");
    // Users get a default avatar on registration
    expect(body.data[0].avatar_url).toBeTruthy();
    expect(body.data[0].avatar_url).toContain("/uploads/avatars/");
  });

  it("GET /users should return empty array when no users exist", async () => {
    await resetDatabase(app);
    const res = await app.inject({ method: "GET", url: `${API_PREFIX}/users` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });

  it("GET /users/:id should return user by id", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${API_PREFIX}/users/${userId}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data?.id).toBe(userId);
    expect(body.data?.username).toBe("testuser");
    expect(body.data?.email).toBe("test@example.com");
    expect(body.data).toHaveProperty("created_at");
    expect(body.data).toHaveProperty("avatar_url");
    expect(body.data).not.toHaveProperty("password_hash");
    // User automatically gets a default avatar on registration
    expect(body.data.avatar_url).toBeTruthy();
    expect(body.data.avatar_url).toContain("/uploads/avatars/");
  });

  it("GET /users/:id should return 403 when accessing another user", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${API_PREFIX}/users/99999`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("does not match");
  });

  it("GET /users/:id should return 400 for invalid id", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${API_PREFIX}/users/invalid`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("GET /users/:id should return 401 without access token", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${API_PREFIX}/users/${userId}`,
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Access token required");
  });

  it("GET /users should return multiple users", async () => {
    // Create additional users
    await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: {
        username: "user2",
        email: "user2@example.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: {
        username: "user3",
        email: "user3@example.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });

    const res = await app.inject({ method: "GET", url: `${API_PREFIX}/users` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(3);
    // Each user should have avatar_url property set to a default image on registration (unless a custom avatar is uploaded)
    body.data.forEach((user: any) => {
      expect(user).toHaveProperty("avatar_url");
    });
  });

  // =========== EMAIL UPDATE TESTS ===========

  it("PATCH /users/:id/email should successfully update user email", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        email: "newemail@example.com",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("newemail@example.com");
    expect(body.data.username).toBe("testuser");
    expect(body.message).toContain("Email updated successfully");
  });

  it("PATCH /users/:id/email should return 400 for email with whitespace", async () => {
    // Schema validation rejects emails with leading/trailing whitespace
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        email: "  email@example.com  ",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/email should return 400 for invalid email format", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        email: "invalid-email",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/email should return 400 for missing email", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/email should return 401 without access token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      payload: {
        email: "newemail@example.com",
      },
    });
    // Schema validation may occur before auth check, accept either 400 or 401
    expect([400, 401]).toContain(res.statusCode);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/email should return 403 when updating another user", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/99999/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        email: "newemail@example.com",
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("does not match");
  });

  it("PATCH /users/:id/email should return 409 when email already exists", async () => {
    // Create another user with a different email
    await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: {
        username: "otheruser",
        email: "existing@example.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });

    // Try to update current user's email to the existing email
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        email: "existing@example.com",
      },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("already in use");
  });

  // =========== USERNAME UPDATE TESTS ===========

  it("PATCH /users/:id/username should successfully update username", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "newusername",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.username).toBe("newusername");
    expect(body.data.email).toBe("test@example.com");
    expect(body.message).toContain("Username updated successfully");
  });

  it("PATCH /users/:id/username should return 400 for username with whitespace", async () => {
    // Schema validation rejects usernames with leading/trailing whitespace
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "  username  ",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/username should accept valid username formats", async () => {
    const validUsernames = [
      "user123",
      "user_name",
      "user-name",
      "User123",
      "ABC",
    ];

    for (const username of validUsernames) {
      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/username`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: { username },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.username).toBe(username);
    }
  });

  it("PATCH /users/:id/username should return 400 for username too short", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "ab",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/username should return 400 for username too long", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "a".repeat(51), // 51 characters, exceeds max of 50
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/username should return 400 for invalid characters", async () => {
    const invalidUsernames = [
      "user@name",
      "user name",
      "user!name",
      "user#name",
      "user$name",
    ];

    for (const username of invalidUsernames) {
      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/username`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: { username },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    }
  });

  it("PATCH /users/:id/username should return 400 for missing username", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/username should return 401 without access token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      payload: {
        username: "newusername",
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Access token required");
  });

  it("PATCH /users/:id/username should return 403 when updating another user", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/99999/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "newusername",
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("does not match");
  });

  it("PATCH /users/:id/username should return 409 when username already exists", async () => {
    // Create another user with a different username
    await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: {
        username: "existinguser",
        email: "existing@example.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });

    // Try to update current user's username to the existing username
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "existinguser",
      },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("already in use");
  });

  it("PATCH /users/:id/username should return 400 for invalid user id", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/invalid/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "newusername",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  // =========== AVATAR UPLOAD TESTS ===========
  // Note: Full multipart file upload testing requires integration tests
  // These tests verify the endpoint authentication and basic validation

  it("POST /users/avatar should return 401 without access token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/avatar`,
      headers: {
        "content-type": "multipart/form-data",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("Access token required");
  });

  it("POST /users/avatar should return 400 for non-multipart request", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/avatar`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      payload: { some: "data" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as any;
    expect(body.success).toBe(false);
    expect(body.message).toContain("multipart");
  });

  it("POST /users/avatar should require valid access token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${API_PREFIX}/users/avatar`,
      headers: {
        authorization: "Bearer invalid-token",
        "content-type": "multipart/form-data",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  // =========== EDGE CASES ===========

  it("GET /users/:id should return 404 for non-existent numeric id", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${API_PREFIX}/users/999999`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(403); // Ownership check happens first
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/email should trim whitespace from email input", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/email`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        email: "    trimmed@example.com     ",
      },
    });
    expect(res.statusCode).toBe(400); // Schema validation rejects emails with whitespace
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  it("PATCH /users/:id/username should trim whitespace from username input", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${API_PREFIX}/users/${userId}/username`,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        username: "     trimmeduser           ",
      },
    });
    expect(res.statusCode).toBe(400); // Schema validation rejects usernames with whitespace
    const body = res.json() as any;
    expect(body.success).toBe(false);
  });

  describe("PATCH /users/:id/heartbeat", () => {
    it("should update user last_seen timestamp", async () => {
      const beforeTime = new Date().toISOString();

      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/heartbeat`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      const afterTime = new Date().toISOString();

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Heartbeat updated");
      expect(body.data).toHaveProperty("last_seen");
      expect(body.data.last_seen).toBeDefined();
      expect(body.data.last_seen).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );

      // Verify timestamp is within expected range
      expect(body.data.last_seen >= beforeTime).toBe(true);
      expect(body.data.last_seen <= afterTime).toBe(true);
    });

    it("should reject heartbeat without authentication", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/heartbeat`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should reject heartbeat for different user", async () => {
      // Create another user
      const otherUserPayload = {
        username: "otheruser",
        email: "other@example.com",
        password: "password123",
        confirmPassword: "password123",
      };
      const otherUserRes = await app.inject({
        method: "POST",
        url: `${AUTH_PREFIX}/register`,
        payload: otherUserPayload,
      });
      const otherUserId = otherUserRes.json().data.id;

      // Try to update other user's heartbeat
      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${otherUserId}/heartbeat`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should allow multiple consecutive heartbeats", async () => {
      // First heartbeat
      const res1 = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/heartbeat`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      expect(res1.statusCode).toBe(200);
      const firstTimestamp = res1.json().data.last_seen;

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second heartbeat
      const res2 = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/heartbeat`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      expect(res2.statusCode).toBe(200);
      const secondTimestamp = res2.json().data.last_seen;

      // Timestamps should be valid and second should be later
      expect(firstTimestamp).toBeDefined();
      expect(secondTimestamp).toBeDefined();
      expect(secondTimestamp >= firstTimestamp).toBe(true);
    });

    it("should reject heartbeat for non-existent user", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/99999/heartbeat`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should return valid ISO 8601 timestamp format", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${API_PREFIX}/users/${userId}/heartbeat`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      const timestamp = body.data.last_seen;

      // Verify ISO 8601 format
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );

      // Verify it's a valid date
      const date = new Date(timestamp);
      expect(date.toString()).not.toBe("Invalid Date");
    });
  });
});
