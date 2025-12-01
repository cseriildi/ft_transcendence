import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { FastifyInstance } from "fastify";
import { createTestApp, cleanupTestApp, resetDatabase } from "./setup";
import { config } from "../src/config";

describe("Friend Routes", () => {
  let app: FastifyInstance;
  const AUTH_PREFIX = config.routes.auth;
  const FRIENDS_PREFIX = `${config.routes.api}/friends`;

  // Test users and tokens
  let user1Token: string;
  let user2Token: string;
  let user3Token: string;
  let user1Id: number;
  let user2Id: number;
  let user3Id: number;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(async () => {
    await resetDatabase(app);

    // Create test users
    const user1Payload = {
      username: "alice",
      email: "alice@example.com",
      password: "password123",
      confirmPassword: "password123",
    };
    const user1Res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: user1Payload,
    });
    const user1Body = user1Res.json() as any;
    if (!user1Body.success || !user1Body.data) {
      throw new Error(`Failed to create user1: ${JSON.stringify(user1Body)}`);
    }
    user1Id = user1Body.data.id;
    user1Token = user1Body.data.tokens.accessToken;

    const user2Payload = {
      username: "bob",
      email: "bob@example.com",
      password: "password123",
      confirmPassword: "password123",
    };
    const user2Res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: user2Payload,
    });
    const user2Body = user2Res.json() as any;
    if (!user2Body.success || !user2Body.data) {
      throw new Error(`Failed to create user2: ${JSON.stringify(user2Body)}`);
    }
    user2Id = user2Body.data.id;
    user2Token = user2Body.data.tokens.accessToken;

    const user3Payload = {
      username: "charlie",
      email: "charlie@example.com",
      password: "password123",
      confirmPassword: "password123",
    };
    const user3Res = await app.inject({
      method: "POST",
      url: `${AUTH_PREFIX}/register`,
      payload: user3Payload,
    });
    const user3Body = user3Res.json() as any;
    if (!user3Body.success || !user3Body.data) {
      throw new Error(`Failed to create user3: ${JSON.stringify(user3Body)}`);
    }
    user3Id = user3Body.data.id;
    user3Token = user3Body.data.tokens.accessToken;
  });

  describe("POST /users/friends/:id (Add Friend)", () => {
    it("should send a friend request successfully", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend request sent");
      expect(body.data.user1_id).toBe(String(user1Id));
      expect(body.data.user2_id).toBe(String(user2Id));
      expect(body.data.action).toBe("add");
      expect(body.data.created_at).toBeDefined();
    });

    it("should reject friend request without authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should reject friend request to self", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user1Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("cannot be the same");
    });

    it("should reject friend request to non-existent user", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/99999`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("not found");
    });

    it("should reject duplicate friend request", async () => {
      // Send first request
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // Try to send again
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("already exists");
    });

    it("should reject friend request when reverse request exists", async () => {
      // User2 sends request to User1
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user1Id}`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // User1 tries to send request to User2
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("already exists");
    });
  });

  describe("PATCH /users/friends/:id/accept (Accept Friend)", () => {
    beforeEach(async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
    });

    it("should accept a friend request successfully", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend request accepted");
      expect(body.data.user1_id).toBe(user2Id.toString());
      expect(body.data.user2_id).toBe(user1Id.toString());
      expect(body.data.action).toBe("accept");
      expect(body.data.updated_at).toBeDefined();
    });

    it("should reject accepting without authentication", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should reject accepting own friend request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user2Id}/accept`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("cannot accept a friend request you sent yourself");
    });

    it("should reject accepting non-existent friend request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user2Id}/accept`,
        headers: {
          authorization: `Bearer ${user3Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("No friend request exists");
    });

    it("should reject accepting already accepted request", async () => {
      // Accept the request
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // Try to accept again
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("already friends");
    });

    it("should reject accepting a declined request", async () => {
      // Decline the request
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // Try to accept it
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("already been declined");
    });
  });

  describe("PATCH /users/friends/:id/decline (Decline Friend)", () => {
    beforeEach(async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
    });

    it("should decline a friend request successfully", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend request declined");
      expect(body.data.user1_id).toBe(user2Id.toString());
      expect(body.data.user2_id).toBe(user1Id.toString());
      expect(body.data.action).toBe("decline");
      expect(body.data.updated_at).toBeDefined();
    });

    it("should reject declining without authentication", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should reject declining own friend request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user2Id}/decline`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("cannot decline a friend request you sent yourself");
    });

    it("should reject declining non-existent friend request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user2Id}/decline`,
        headers: {
          authorization: `Bearer ${user3Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("No friend request exists");
    });

    it("should reject declining already accepted friendship", async () => {
      // Accept the request first
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // Try to decline
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("already friends");
    });

    it("should reject declining already declined request", async () => {
      // Decline the request
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // Try to decline again
      const res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("already been declined");
    });
  });

  describe("DELETE /users/friends/:id (Remove Friend)", () => {
    it("should remove a pending friend request (inviter can delete)", async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // User1 (inviter) removes the request
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend removed successfully");
      expect(body.data.user1_id).toBe(user1Id.toString());
      expect(body.data.user2_id).toBe(user2Id.toString());
      expect(body.data.action).toBe("remove");
      expect(body.data.updated_at).toBeDefined();
    });

    it("should remove a pending friend request (receiver can delete)", async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // User2 (receiver) removes the request
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user1Id}`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend removed successfully");
    });

    it("should remove an accepted friendship (either user)", async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // User2 accepts
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // User1 removes the friendship
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend removed successfully");
    });

    it("should reject removing without authentication", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
      });

      expect(res.statusCode).toBe(401);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should reject removing non-existent friendship", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("No friend request exists");
    });

    it("should reject inviter removing their own declined request", async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // User2 declines the request
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // User1 (inviter) tries to delete the declined request
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain(
        "cannot delete a friend request you sent yourself that has been declined"
      );
    });

    it("should allow receiver to delete declined request", async () => {
      // User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // User2 declines the request
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // User2 (receiver) can delete the declined request
      const res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user1Id}`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Friend removed successfully");
    });

    it("should cascade delete game invitations when friendship is removed", async () => {
      const GAME_INVITES_PREFIX = `${config.routes.api}/game-invites`;

      // Step 1: User1 sends friend request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // Step 2: User2 accepts friendship
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // Step 3: User1 creates a game invitation to User2
      const inviteRes = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(inviteRes.statusCode).toBe(200);
      const inviteBody = inviteRes.json() as any;
      expect(inviteBody.success).toBe(true);
      const gameInviteId = inviteBody.data.game_id;

      // Step 4: Verify game invitation exists
      const getInviteRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameInviteId}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(getInviteRes.statusCode).toBe(200);

      // Step 5: Remove friendship
      const removeRes = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(removeRes.statusCode).toBe(200);

      // Step 6: Verify game invitation was CASCADE deleted
      const checkInviteRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameInviteId}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(checkInviteRes.statusCode).toBe(404);
      const checkBody = checkInviteRes.json() as any;
      expect(checkBody.success).toBe(false);
      expect(checkBody.message).toContain("Game invitation not found");
    });
  });

  describe("Complex Friend Scenarios", () => {
    it("should handle full friend lifecycle: request -> accept -> remove", async () => {
      // Step 1: User1 sends friend request to User2
      const addRes = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(addRes.statusCode).toBe(200);

      // Step 2: User2 accepts the friend request
      const acceptRes = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });
      expect(acceptRes.statusCode).toBe(200);

      // Step 3: User1 removes the friendship
      const removeRes = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(removeRes.statusCode).toBe(200);

      // Step 4: Verify they can become friends again
      const addAgainRes = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(addAgainRes.statusCode).toBe(200);
    });

    it("should handle full friend lifecycle: request -> decline -> delete", async () => {
      // Step 1: User1 sends friend request to User2
      const addRes = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(addRes.statusCode).toBe(200);

      // Step 2: User2 declines the friend request
      const declineRes = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });
      expect(declineRes.statusCode).toBe(200);

      // Step 3: User2 removes the declined request
      const removeRes = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user1Id}`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });
      expect(removeRes.statusCode).toBe(200);

      // Step 4: Verify they can try again
      const addAgainRes = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(addAgainRes.statusCode).toBe(200);
    });

    it("should handle multiple simultaneous friend relationships", async () => {
      // User1 -> User2 (pending)
      const add1Res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(add1Res.statusCode).toBe(200);

      // User1 -> User3 (pending)
      const add2Res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user3Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(add2Res.statusCode).toBe(200);

      // User2 accepts
      const accept1Res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });
      expect(accept1Res.statusCode).toBe(200);

      // User3 declines
      const decline1Res = await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
        headers: {
          authorization: `Bearer ${user3Token}`,
        },
      });
      expect(decline1Res.statusCode).toBe(200);

      // Verify User1-User2 are friends (can remove)
      const remove1Res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(remove1Res.statusCode).toBe(200);

      // Verify User1 cannot remove declined request they sent
      const remove2Res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user3Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      expect(remove2Res.statusCode).toBe(409);
    });

    it("should handle bidirectional friend operations correctly", async () => {
      // User1 sends request to User2
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      // User2 accepts
      await app.inject({
        method: "PATCH",
        url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });

      // Both users can remove the friendship
      const removeByUser2Res = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user1Id}`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
      });
      expect(removeByUser2Res.statusCode).toBe(200);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid user ID format", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/invalid`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should handle negative user ID", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/-1`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should handle very large user ID", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/999999999`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should use consistent timestamps in responses", async () => {
      const beforeTime = new Date().toISOString();

      const res = await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      const afterTime = new Date().toISOString();
      const body = res.json() as any;

      expect(body.data.created_at).toBeDefined();
      expect(body.data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(body.data.created_at >= beforeTime).toBe(true);
      expect(body.data.created_at <= afterTime).toBe(true);
    });
  });

  describe("Friend Online Status Tracking", () => {
    const USERS_PREFIX = `${config.routes.api}/users`;

    describe("PATCH /users/:id/heartbeat (Update Online Status)", () => {
      it("should update user last_seen timestamp on heartbeat", async () => {
        const beforeTime = new Date().toISOString();

        const res = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user1Id}/heartbeat`,
          headers: {
            authorization: `Bearer ${user1Token}`,
          },
        });

        const afterTime = new Date().toISOString();

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        expect(body.success).toBe(true);
        expect(body.message).toBe("Heartbeat updated");
        expect(body.data.last_seen).toBeDefined();
        expect(body.data.last_seen).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(body.data.last_seen >= beforeTime).toBe(true);
        expect(body.data.last_seen <= afterTime).toBe(true);
      });

      it("should reject heartbeat without authentication", async () => {
        const res = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user1Id}/heartbeat`,
        });

        expect(res.statusCode).toBe(401);
        const body = res.json() as any;
        expect(body.success).toBe(false);
      });

      it("should reject heartbeat for different user", async () => {
        const res = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: {
            authorization: `Bearer ${user1Token}`,
          },
        });

        expect(res.statusCode).toBe(403);
        const body = res.json() as any;
        expect(body.success).toBe(false);
      });

      it("should allow multiple heartbeats and update timestamp each time", async () => {
        // First heartbeat
        const res1 = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user1Id}/heartbeat`,
          headers: {
            authorization: `Bearer ${user1Token}`,
          },
        });
        expect(res1.statusCode).toBe(200);
        const firstTimestamp = res1.json().data.last_seen;

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Second heartbeat
        const res2 = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user1Id}/heartbeat`,
          headers: {
            authorization: `Bearer ${user1Token}`,
          },
        });
        expect(res2.statusCode).toBe(200);
        const secondTimestamp = res2.json().data.last_seen;

        // Second timestamp should be later than first
        expect(secondTimestamp > firstTimestamp).toBe(true);
      });
    });

    describe("GET /friends/status (Get Friends Online Status)", () => {
      beforeEach(async () => {
        // Set up friendships for testing
        // User1 -> User2: accepted
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 -> User3: accepted
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user3Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user3Token}` },
        });
      });

      it("should return friends status with empty last_seen by default", async () => {
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: {
            authorization: `Bearer ${user1Token}`,
          },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        expect(body.success).toBe(true);
        expect(body.message).toBe("Friends status retrieved");
        expect(body.data).toBeDefined();
        expect(body.data.friends).toBeDefined();
        expect(Array.isArray(body.data.friends)).toBe(true);
        expect(body.data.friends.length).toBe(2);
        expect(body.data.online_threshold_minutes).toBe(2);

        // Check structure of friend status
        const friend = body.data.friends[0];
        expect(friend).toHaveProperty("user_id");
        expect(friend).toHaveProperty("username");
        expect(friend).toHaveProperty("is_online");
        expect(friend).toHaveProperty("last_seen");

        // Initially, no one has sent heartbeat, so all offline
        expect(friend.is_online).toBe(false);
        expect(friend.last_seen).toBeNull();
      });

      it("should show friend as online after recent heartbeat", async () => {
        // User2 sends heartbeat
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 checks friends status
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;

        const user2Status = body.data.friends.find((f: any) => f.user_id === user2Id);
        expect(user2Status).toBeDefined();
        expect(user2Status.is_online).toBe(true);
        expect(user2Status.last_seen).not.toBeNull();
        expect(user2Status.username).toBe("bob");
      });

      it("should show multiple friends with different online statuses", async () => {
        // User2 sends heartbeat (will be online)
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User3 doesn't send heartbeat (will be offline)

        // User1 checks friends status
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        expect(body.data.friends.length).toBe(2);

        const user2Status = body.data.friends.find((f: any) => f.user_id === user2Id);
        const user3Status = body.data.friends.find((f: any) => f.user_id === user3Id);

        expect(user2Status.is_online).toBe(true);
        expect(user2Status.last_seen).not.toBeNull();

        expect(user3Status.is_online).toBe(false);
        expect(user3Status.last_seen).toBeNull();
      });

      it("should reject friends status request without authentication", async () => {
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
        });

        expect(res.statusCode).toBe(401);
        const body = res.json() as any;
        expect(body.success).toBe(false);
      });

      it("should return empty friends array for user with no friends", async () => {
        // Create a new user with no friends
        const newUserPayload = {
          username: "loner",
          email: "loner@example.com",
          password: "password123",
          confirmPassword: "password123",
        };
        const newUserRes = await app.inject({
          method: "POST",
          url: `${AUTH_PREFIX}/register`,
          payload: newUserPayload,
        });
        const newUserBody = newUserRes.json() as any;
        const newUserToken = newUserBody.data.tokens.accessToken;

        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${newUserToken}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        expect(body.success).toBe(true);
        expect(body.data.friends).toEqual([]);
      });

      it("should return all friend requests including pending and declined with their status", async () => {
        // Create user4
        const user4Payload = {
          username: "dave",
          email: "dave@example.com",
          password: "password123",
          confirmPassword: "password123",
        };
        const user4Res = await app.inject({
          method: "POST",
          url: `${AUTH_PREFIX}/register`,
          payload: user4Payload,
        });
        const user4Body = user4Res.json() as any;
        const user4Id = user4Body.data.id;

        // User1 -> User4: pending (not accepted)
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user4Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // User1 checks friends status (should see all 3: user2 accepted, user3 accepted, user4 pending)
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        expect(body.data.friends.length).toBe(3);

        const friendIds = body.data.friends.map((f: any) => f.user_id);
        expect(friendIds).toContain(user2Id);
        expect(friendIds).toContain(user3Id);
        expect(friendIds).toContain(user4Id);

        // Check that status is included
        const user2Friend = body.data.friends.find((f: any) => f.user_id === user2Id);
        const user3Friend = body.data.friends.find((f: any) => f.user_id === user3Id);
        const user4Friend = body.data.friends.find((f: any) => f.user_id === user4Id);

        expect(user2Friend.status).toBe("accepted");
        expect(user3Friend.status).toBe("accepted");
        expect(user4Friend.status).toBe("pending");

        // Check inviter information
        expect(user2Friend.inviter_id).toBe(user1Id);
        expect(user2Friend.is_inviter).toBe(true);
        expect(user3Friend.inviter_id).toBe(user1Id);
        expect(user3Friend.is_inviter).toBe(true);
        expect(user4Friend.inviter_id).toBe(user1Id);
        expect(user4Friend.is_inviter).toBe(true);
      });

      it("should show friends sorted by status (pending first), then online status, then alphabetically", async () => {
        // User3 sends heartbeat (charlie will be online)
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user3Id}/heartbeat`,
          headers: { authorization: `Bearer ${user3Token}` },
        });

        // User2 doesn't send heartbeat (bob will be offline)

        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        const friends = body.data.friends;

        // Both friends are accepted status, so sorting is by online status then alphabetically
        // First friend should be online (charlie)
        expect(friends[0].is_online).toBe(true);
        expect(friends[0].username).toBe("charlie");
        expect(friends[0].status).toBe("accepted");

        // Second friend should be offline (bob)
        expect(friends[1].is_online).toBe(false);
        expect(friends[1].username).toBe("bob");
        expect(friends[1].status).toBe("accepted");
      });

      it("should update last_seen timestamp correctly across multiple heartbeats", async () => {
        // First heartbeat
        const firstHeartbeat = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });
        const firstTimestamp = firstHeartbeat.json().data.last_seen;

        // Check status
        const firstStatus = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        const user2FirstStatus = firstStatus
          .json()
          .data.friends.find((f: any) => f.user_id === user2Id);
        expect(user2FirstStatus.last_seen).toBe(firstTimestamp);
        expect(user2FirstStatus.is_online).toBe(true);

        // Wait and send another heartbeat
        await new Promise((resolve) => setTimeout(resolve, 100));

        const secondHeartbeat = await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });
        const secondTimestamp = secondHeartbeat.json().data.last_seen;

        // Check status again
        const secondStatus = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        const user2SecondStatus = secondStatus
          .json()
          .data.friends.find((f: any) => f.user_id === user2Id);
        expect(user2SecondStatus.last_seen).toBe(secondTimestamp);
        expect(user2SecondStatus.last_seen > user2FirstStatus.last_seen).toBe(true);
        expect(user2SecondStatus.is_online).toBe(true);
      });
    });

    describe("Online Status Integration Tests", () => {
      it("should handle real-world scenario: two friends, one online, checking each other", async () => {
        // Make User1 and User2 friends
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 sends heartbeat (becomes online)
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user1Id}/heartbeat`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // User2 checks status and sees User1 online
        const user2Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user2Token}` },
        });
        const user2View = user2Check.json().data.friends.find((f: any) => f.user_id === user1Id);
        expect(user2View.is_online).toBe(true);
        expect(user2View.username).toBe("alice");

        // User1 checks status and sees User2 offline
        const user1Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        const user1View = user1Check.json().data.friends.find((f: any) => f.user_id === user2Id);
        expect(user1View.is_online).toBe(false);
        expect(user1View.username).toBe("bob");

        // User2 sends heartbeat (also becomes online)
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 checks again and now sees User2 online
        const user1CheckAgain = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        const user1ViewAgain = user1CheckAgain
          .json()
          .data.friends.find((f: any) => f.user_id === user2Id);
        expect(user1ViewAgain.is_online).toBe(true);
      });

      it("should not show removed friends in status even if they are online", async () => {
        // User1 and User2 are friends
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User2 sends heartbeat (online)
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 removes friendship
        await app.inject({
          method: "DELETE",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // User1 checks status (should not see User2)
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as any;
        expect(body.data.friends.length).toBe(0);
      });

      it("should handle bidirectional friendship status checks", async () => {
        // User1 and User2 are friends
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // Both send heartbeats
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user1Id}/heartbeat`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${USERS_PREFIX}/${user2Id}/heartbeat`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 sees User2 online
        const user1Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        const user1View = user1Check.json().data.friends[0];
        expect(user1View.user_id).toBe(user2Id);
        expect(user1View.is_online).toBe(true);

        // User2 sees User1 online
        const user2Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user2Token}` },
        });
        const user2View = user2Check.json().data.friends[0];
        expect(user2View.user_id).toBe(user1Id);
        expect(user2View.is_online).toBe(true);
      });
    });

    describe("Friend Request Status and Inviter Information", () => {
      it("should include inviter information for all friend requests", async () => {
        // User1 sends request to User2
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // User2 checks status and sees pending request from User1
        const user2Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        expect(user2Check.statusCode).toBe(200);
        const user2Body = user2Check.json() as any;
        expect(user2Body.data.friends.length).toBe(1);

        const friendRequest = user2Body.data.friends[0];
        expect(friendRequest.user_id).toBe(user1Id);
        expect(friendRequest.status).toBe("pending");
        expect(friendRequest.inviter_id).toBe(user1Id);
        expect(friendRequest.inviter_username).toBe("alice");
        expect(friendRequest.is_inviter).toBe(false); // User2 is not the inviter

        // User1 checks status and sees their own pending request
        const user1Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        const user1Body = user1Check.json() as any;
        expect(user1Body.data.friends.length).toBe(1);

        const sentRequest = user1Body.data.friends[0];
        expect(sentRequest.user_id).toBe(user2Id);
        expect(sentRequest.status).toBe("pending");
        expect(sentRequest.inviter_id).toBe(user1Id);
        expect(sentRequest.inviter_username).toBe("alice");
        expect(sentRequest.is_inviter).toBe(true); // User1 is the inviter
      });

      it("should show declined requests with correct status", async () => {
        // User1 sends request to User2
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // User2 declines the request
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 checks status and sees declined request
        const user1Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        const user1Body = user1Check.json() as any;
        expect(user1Body.data.friends.length).toBe(1);

        const declinedRequest = user1Body.data.friends[0];
        expect(declinedRequest.user_id).toBe(user2Id);
        expect(declinedRequest.status).toBe("declined");
        expect(declinedRequest.inviter_id).toBe(user1Id);
        expect(declinedRequest.is_inviter).toBe(true);

        // User2 also sees the declined request
        const user2Check = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        const user2Body = user2Check.json() as any;
        expect(user2Body.data.friends.length).toBe(1);

        const declinedByUser2 = user2Body.data.friends[0];
        expect(declinedByUser2.user_id).toBe(user1Id);
        expect(declinedByUser2.status).toBe("declined");
        expect(declinedByUser2.inviter_id).toBe(user1Id);
        expect(declinedByUser2.is_inviter).toBe(false);
      });

      it("should sort friend requests by status: pending, accepted, declined", async () => {
        // Create additional users
        const user4Payload = {
          username: "dave",
          email: "dave@example.com",
          password: "password123",
          confirmPassword: "password123",
        };
        const user4Res = await app.inject({
          method: "POST",
          url: `${AUTH_PREFIX}/register`,
          payload: user4Payload,
        });
        const user4Body = user4Res.json() as any;
        const user4Id = user4Body.data.id;
        const user4Token = user4Body.data.tokens.accessToken;

        // User1 -> User2: accepted
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // User1 -> User3: pending
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user3Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // User1 -> User4: declined
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user4Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/decline`,
          headers: { authorization: `Bearer ${user4Token}` },
        });

        // User1 checks status - should see pending first, then accepted, then declined
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        const body = res.json() as any;
        expect(body.data.friends.length).toBe(3);

        // Order should be: pending (user3), accepted (user2), declined (user4)
        expect(body.data.friends[0].status).toBe("pending");
        expect(body.data.friends[0].user_id).toBe(user3Id);

        expect(body.data.friends[1].status).toBe("accepted");
        expect(body.data.friends[1].user_id).toBe(user2Id);

        expect(body.data.friends[2].status).toBe("declined");
        expect(body.data.friends[2].user_id).toBe(user4Id);
      });

      it("should include created_at and updated_at timestamps", async () => {
        // User1 sends request to User2
        await app.inject({
          method: "POST",
          url: `${FRIENDS_PREFIX}/${user2Id}`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        // Check status
        const res = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        const body = res.json() as any;
        const friendRequest = body.data.friends[0];

        expect(friendRequest.created_at).toBeDefined();
        expect(friendRequest.updated_at).toBeDefined();
        expect(typeof friendRequest.created_at).toBe("string");
        expect(typeof friendRequest.updated_at).toBe("string");

        // Accept the request
        await app.inject({
          method: "PATCH",
          url: `${FRIENDS_PREFIX}/${user1Id}/accept`,
          headers: { authorization: `Bearer ${user2Token}` },
        });

        // Check that updated_at changed
        const res2 = await app.inject({
          method: "GET",
          url: `${FRIENDS_PREFIX}/status`,
          headers: { authorization: `Bearer ${user1Token}` },
        });

        const body2 = res2.json() as any;
        const acceptedFriend = body2.data.friends[0];

        expect(acceptedFriend.created_at).toBe(friendRequest.created_at);
        expect(acceptedFriend.updated_at).not.toBe(friendRequest.updated_at);
      });
    });
  });
});
