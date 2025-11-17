import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import dbConnector from "../src/database.ts";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import fs from "fs";

// We'll need to create a testable version of the app
// since main.ts has side effects (validateConfig, start())
async function createTestApp() {
  const app = Fastify({ logger: false });
  const testDbPath = "./test-main.db";

  await app.register(import("@fastify/websocket"));
  await app.register(rateLimit, {
    max: 100, // Higher limit for tests
    timeWindow: "1 minute",
  });

  await app.register(helmet, { global: true });
  await app.register(dbConnector, { path: testDbPath });

  await app.register(cors, {
    origin: "http://localhost:4200",
    credentials: true,
  });

  // Store active connections per chat room
  const chatRooms = new Map<string, Map<any, string>>();
  const lobbyConnections = new Map<any, string>();
  const userLobbyConnections = new Map<string, Set<any>>();
  const banList = new Map<string, Set<{ banned: string }>>();

  const chatHistory = new Map<
    string,
    Array<{
      username: string;
      message: string;
      timestamp: number;
    }>
  >();

  const MAX_MESSAGES = 20;

  await app.register(async (fastify) => {
    fastify.get("/health", async (request, reply) => {
      return { status: "ok" };
    });

    fastify.get("/ready", async (request, reply) => {
      return new Promise(async (resolve, reject) => {
        try {
          const db = await request.server.db;
          db.get("SELECT 1", (err: any) => {
            if (err) {
              reject(err);
            }
            resolve(true);
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    fastify.post("/lobby/block", async (request, reply) => {
      const { blocker, blocked } = request.body as {
        blocker: string;
        blocked: string;
      };

      if (!blocker || !blocked) {
        return reply.status(400).send({ error: "Missing blocker or blocked username" });
      }

      if (!userLobbyConnections.has(blocker)) {
        return reply.status(401).send({ error: "Blocking user is not authorized" });
      }

      // Add to in-memory ban list
      if (!banList.has(blocker)) {
        banList.set(blocker, new Set());
      }
      banList.get(blocker)!.add({ banned: blocked });

      // Persist to database
      try {
        const db = await request.server.db;
        return new Promise((resolve, reject) => {
          db.run(
            "INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)",
            [blocker, blocked],
            (err: any) => {
              if (err) {
                fastify.log.error(
                  "Error blocking user %s for %s: %s",
                  blocked,
                  blocker,
                  err.message
                );
                reject(err);
              }
              resolve({ success: true });
            }
          );
        });
      } catch (err) {
        fastify.log.error("Database connection error: %s", String(err));
        return reply.status(500).send({ error: "Database connection error" });
      }
    });
  });

  return { app, testDbPath, userLobbyConnections, banList };
}

describe("Main Application - HTTP Endpoints", () => {
  let app: FastifyInstance;
  let testDbPath: string;
  let userLobbyConnections: Map<string, Set<any>>;
  let banList: Map<string, Set<{ banned: string }>>;

  beforeEach(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    testDbPath = testApp.testDbPath;
    userLobbyConnections = testApp.userLobbyConnections;
    banList = testApp.banList;

    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("GET /health", () => {
    it("should return ok status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: "ok" });
    });

    it("should respond quickly", async () => {
      const start = Date.now();
      await app.inject({
        method: "GET",
        url: "/health",
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe("GET /ready", () => {
    it("should return success when database is ready", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/ready",
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("true");
    });

    it("should check database connectivity", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/ready",
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("POST /lobby/block", () => {
    it("should return 400 when blocker is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocked: "user2",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: "Missing blocker or blocked username",
      });
    });

    it("should return 400 when blocked is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocker: "user1",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: "Missing blocker or blocked username",
      });
    });

    it("should return 401 when blocker is not in lobby", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocker: "alice",
          blocked: "bob",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: "Blocking user is not authorized",
      });
    });

    it("should successfully block user when blocker is authorized", async () => {
      // Simulate alice being in the lobby
      userLobbyConnections.set("alice", new Set());

      const response = await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocker: "alice",
          blocked: "bob",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ success: true });

      // Check in-memory ban list
      expect(banList.has("alice")).toBe(true);
      const bans = Array.from(banList.get("alice")!);
      expect(bans.some((ban) => ban.banned === "bob")).toBe(true);
    });

    it("should persist block to database", async () => {
      userLobbyConnections.set("alice", new Set());

      await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocker: "alice",
          blocked: "bob",
        },
      });

      // Verify in database
      const rows: any = await new Promise((resolve, reject) => {
        app.db.all(
          "SELECT * FROM blocks WHERE blocker = ? AND blocked_user = ?",
          ["alice", "bob"],
          (err: any, rows: any) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(rows.length).toBe(1);
      expect(rows[0].blocker).toBe("alice");
      expect(rows[0].blocked_user).toBe("bob");
    });

    it("should allow blocking multiple users", async () => {
      userLobbyConnections.set("alice", new Set());

      await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocker: "alice",
          blocked: "bob",
        },
      });

      await app.inject({
        method: "POST",
        url: "/lobby/block",
        payload: {
          blocker: "alice",
          blocked: "charlie",
        },
      });

      // Check in-memory ban list
      const bans = Array.from(banList.get("alice")!);
      expect(bans.length).toBe(2);
      expect(bans.some((ban) => ban.banned === "bob")).toBe(true);
      expect(bans.some((ban) => ban.banned === "charlie")).toBe(true);
    });
  });

  describe("CORS Configuration", () => {
    it("should have CORS headers", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: {
          origin: "http://localhost:4200",
        },
      });

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });
  });

  describe("Security Headers", () => {
    it("should have security headers from helmet", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      // Helmet adds various security headers
      expect(response.headers["x-dns-prefetch-control"]).toBeDefined();
      expect(response.headers["x-frame-options"]).toBeDefined();
    });
  });
});
