import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { FastifyInstance } from "fastify";
import { createTestApp, cleanupTestApp, resetDatabase } from "./setup";
import { config } from "../src/config";

describe("Game Invite Routes", () => {
  let app: FastifyInstance;
  const AUTH_PREFIX = config.routes.auth;
  const FRIENDS_PREFIX = `${config.routes.api}/friends`;
  const GAME_INVITES_PREFIX = `${config.routes.api}/game-invites`;

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

  describe("POST /api/game-invites/:id (Create Game Invite)", () => {
    it("should create a game invitation between friends successfully", async () => {
      // First, establish friendship
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

      // Create game invite
      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Game invitation created successfully");
      expect(body.data.game_id).toBeTypeOf("number");
      expect(body.data.inviter_id).toBe(String(user1Id));
      expect(body.data.invitee_id).toBe(String(user2Id));
      expect(body.data.status).toBe("pending");
      expect(body.data.created_at).toBeDefined();
    });

    it("should return existing pending invitation if one already exists", async () => {
      // Establish friendship
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

      // Create first invite
      const res1 = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      const body1 = res1.json() as any;
      const gameId1 = body1.data.game_id;

      // Try to create another invite
      const res2 = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res2.statusCode).toBe(200);
      const body2 = res2.json() as any;
      expect(body2.success).toBe(true);
      expect(body2.message).toBe("Game invitation already exists");
      expect(body2.data.game_id).toBe(gameId1); // Same game ID
    });

    it("should return existing invitation even if created by the other user", async () => {
      // Establish friendship
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

      // User2 creates invite to user1
      const res1 = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user1Id}`,
        headers: { authorization: `Bearer ${user2Token}` },
      });
      const body1 = res1.json() as any;
      const gameId1 = body1.data.game_id;

      // User1 tries to create invite to user2
      const res2 = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res2.statusCode).toBe(200);
      const body2 = res2.json() as any;
      expect(body2.data.game_id).toBe(gameId1); // Same game ID
    });

    it("should fail when trying to invite yourself", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user1Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("cannot be the same");
    });

    it("should fail when users are not friends", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("not friends");
    });

    it("should fail when friendship is only pending", async () => {
      // Send friend request but don't accept
      await app.inject({
        method: "POST",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("not friends");
    });

    it("should fail when not authenticated", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it("should fail when target user does not exist", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/99999`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should fail with invalid user ID format", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/-5`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("params/id must be >= 1");
    });
  });

  describe("GET /api/game-invites/:id (Get Game Invite)", () => {
    let gameId: number;

    beforeEach(async () => {
      // Setup friendship and create invite
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
      const inviteRes = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      gameId = inviteRes.json<any>().data.game_id;
    });

    it("should retrieve game invitation as inviter", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.game_id).toBe(gameId);
      expect(body.data.inviter_id).toBe(String(user1Id));
      expect(body.data.invitee_id).toBe(String(user2Id));
      expect(body.data.inviter_username).toBe("alice");
      expect(body.data.invitee_username).toBe("bob");
      expect(body.data.status).toBe("pending");
      expect(body.data.created_at).toBeDefined();
      expect(body.data.updated_at).toBeDefined();
    });

    it("should retrieve game invitation as invitee", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user2Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.game_id).toBe(gameId);
    });

    it("should fail when unauthorized user tries to view", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user3Token}` },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("not authorized");
    });

    it("should fail when game invitation does not exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/99999`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should fail when not authenticated", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it("should fail with invalid game ID format", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/-1`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("params/id must be >= 1");
    });
  });

  describe("DELETE /api/game-invites/:id (Cancel Game Invite)", () => {
    let gameId: number;

    beforeEach(async () => {
      // Setup friendship and create invite
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
      const inviteRes = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      gameId = inviteRes.json<any>().data.game_id;
    });

    it("should cancel game invitation as inviter", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.message).toBe("Game invitation cancelled");
      expect(body.data.game_id).toBe(gameId);
      expect(body.data.status).toBe("cancelled");

      // Verify it's deleted
      const getRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it("should cancel game invitation as invitee", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user2Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
    });

    it("should fail when unauthorized user tries to cancel", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user3Token}` },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("not authorized");
    });

    it("should fail when game invitation does not exist", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${GAME_INVITES_PREFIX}/99999`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json() as any;
      expect(body.success).toBe(false);
    });

    it("should fail when not authenticated", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it("should fail with invalid game ID format", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${GAME_INVITES_PREFIX}/0`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json() as any;
      expect(body.success).toBe(false);
      expect(body.message).toContain("params/id must be >= 1");
    });
  });

  describe("GET /api/game-invites (List Game Invites)", () => {
    it("should list all game invitations for current user", async () => {
      // Setup friendships
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

      // Create invites
      await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user1Id}`,
        headers: { authorization: `Bearer ${user3Token}` },
      });

      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.invites).toHaveLength(2);
      expect(body.data.pending_count).toBe(2);

      // Verify structure
      const invite1 = body.data.invites[0];
      expect(invite1.game_id).toBeTypeOf("number");
      expect(invite1.inviter_id).toBeDefined();
      expect(invite1.invitee_id).toBeDefined();
      expect(invite1.inviter_username).toBeDefined();
      expect(invite1.invitee_username).toBeDefined();
      expect(invite1.status).toBe("pending");
      expect(invite1.is_sender).toBeTypeOf("boolean");
      expect(invite1.created_at).toBeDefined();
      expect(invite1.updated_at).toBeDefined();
    });

    it("should correctly identify is_sender field", async () => {
      // Setup friendship
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

      // User1 creates invite
      await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      // User1 checks - should see is_sender: true
      const res1 = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      const body1 = res1.json() as any;
      expect(body1.data.invites[0].is_sender).toBe(true);

      // User2 checks - should see is_sender: false
      const res2 = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
        headers: { authorization: `Bearer ${user2Token}` },
      });
      const body2 = res2.json() as any;
      expect(body2.data.invites[0].is_sender).toBe(false);
    });

    it("should return empty list when no invitations exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.invites).toHaveLength(0);
      expect(body.data.pending_count).toBe(0);
    });

    it("should fail when not authenticated", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("CASCADE Delete Behavior", () => {
    it("should automatically delete game invites when friendship is removed", async () => {
      // 1. Establish friendship between user1 and user2
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

      // 2. Create a game invite
      const createRes = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(createRes.statusCode).toBe(200);
      const createBody = createRes.json() as any;
      const gameId = createBody.data.game_id;

      // 3. Verify game invite exists
      const getRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(getRes.statusCode).toBe(200);

      // 4. Remove the friendship
      const removeRes = await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(removeRes.statusCode).toBe(200);

      // 5. Verify game invite was automatically deleted (CASCADE)
      const getAfterRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}/${gameId}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(getAfterRes.statusCode).toBe(404);
      const errorBody = getAfterRes.json() as any;
      expect(errorBody.success).toBe(false);
      expect(errorBody.message).toContain("not found");
    });

    it("should cascade delete all game invites when friendship is removed", async () => {
      // 1. Establish friendship
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

      // 2. Create a game invite
      const invite1Res = await app.inject({
        method: "POST",
        url: `${GAME_INVITES_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(invite1Res.statusCode).toBe(200);

      // List invites before deletion - should have 1 pending
      const listBeforeRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(listBeforeRes.statusCode).toBe(200);
      const listBeforeBody = listBeforeRes.json() as any;
      expect(listBeforeBody.data.invites).toHaveLength(1);
      expect(listBeforeBody.data.pending_count).toBe(1);

      // Remove the friendship
      await app.inject({
        method: "DELETE",
        url: `${FRIENDS_PREFIX}/${user2Id}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      // List invites - should be empty (deleted by CASCADE)
      const listAfterRes = await app.inject({
        method: "GET",
        url: `${GAME_INVITES_PREFIX}`,
        headers: { authorization: `Bearer ${user1Token}` },
      });
      expect(listAfterRes.statusCode).toBe(200);
      const listAfterBody = listAfterRes.json() as any;
      expect(listAfterBody.data.invites).toHaveLength(0);
      expect(listAfterBody.data.pending_count).toBe(0);
    });
  });
});
