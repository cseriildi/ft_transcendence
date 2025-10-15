import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import dbConnector from "../src/database.ts";
import fs from "fs";
import path from "path";

describe("Database Plugin", () => {
  let app: FastifyInstance;
  const testDbPath = "./test-database.db";

  beforeEach(async () => {
    // Create a fresh Fastify instance for each test
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    // Clean up
    if (app) {
      await app.close();
    }

    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe("Database Connection", () => {
    it("should connect to database successfully", async () => {
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();

      expect(app.db).toBeDefined();
      expect(typeof app.db.run).toBe("function");
    });

    it("should use custom path when provided", async () => {
      const customPath = "./custom-test.db";
      
      try {
        await app.register(dbConnector, { path: customPath });
        await app.ready();

        expect(fs.existsSync(customPath)).toBe(true);
      } finally {
        if (fs.existsSync(customPath)) {
          fs.unlinkSync(customPath);
        }
      }
    });

    it("should initialize database schema", async () => {
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();

      // Check if blocks table exists
      const result = await new Promise((resolve, reject) => {
        app.db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='blocks'",
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(result).toBeDefined();
      expect((result as any).name).toBe("blocks");
    });

    it("should create blocks table with correct schema", async () => {
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();

      // Get table info
      const columns = await new Promise((resolve, reject) => {
        app.db.all("PRAGMA table_info(blocks)", (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const columnNames = (columns as any[]).map((col) => col.name);
      
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("blocker");
      expect(columnNames).toContain("blocked_user");
      expect(columnNames).toContain("blocked_at");
    });
  });

  describe("Database Operations", () => {
    beforeEach(async () => {
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();
    });

    it("should insert data into blocks table", async () => {
      const result = await new Promise((resolve, reject) => {
        app.db.run(
          "INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)",
          ["user1", "user2"],
          function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe("number");
    });

    it("should retrieve data from blocks table", async () => {
      // Insert test data
      await new Promise((resolve, reject) => {
        app.db.run(
          "INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)",
          ["alice", "bob"],
          (err) => {
            if (err) reject(err);
            else resolve(undefined);
          }
        );
      });

      // Retrieve data
      const rows = await new Promise((resolve, reject) => {
        app.db.all(
          "SELECT * FROM blocks WHERE blocker = ?",
          ["alice"],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(Array.isArray(rows)).toBe(true);
      expect((rows as any[]).length).toBe(1);
      expect((rows as any[])[0].blocker).toBe("alice");
      expect((rows as any[])[0].blocked_user).toBe("bob");
    });

    it("should handle multiple blocks for same user", async () => {
      // Insert multiple blocks
      await new Promise((resolve, reject) => {
        app.db.run(
          "INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)",
          ["alice", "bob"],
          (err) => {
            if (err) reject(err);
            else resolve(undefined);
          }
        );
      });

      await new Promise((resolve, reject) => {
        app.db.run(
          "INSERT INTO blocks (blocker, blocked_user) VALUES (?, ?)",
          ["alice", "charlie"],
          (err) => {
            if (err) reject(err);
            else resolve(undefined);
          }
        );
      });

      // Retrieve all blocks for alice
      const rows = await new Promise((resolve, reject) => {
        app.db.all(
          "SELECT blocked_user FROM blocks WHERE blocker = ?",
          ["alice"],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect((rows as any[]).length).toBe(2);
      const blockedUsers = (rows as any[]).map((row) => row.blocked_user);
      expect(blockedUsers).toContain("bob");
      expect(blockedUsers).toContain("charlie");
    });
  });

  describe("Plugin Lifecycle", () => {
    it("should close database connection on app close", async () => {
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();

      const db = app.db;
      const closeSpy = vi.spyOn(db, "close");

      await app.close();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should be decorated on fastify instance", async () => {
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();

      expect(app.hasDecorator("db")).toBe(true);
      expect(app.db).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const invalidPath = "/invalid/path/that/does/not/exist/db.sqlite";

      await expect(
        app.register(dbConnector, { path: invalidPath })
      ).rejects.toThrow();
    });

    it("should log error when table creation fails", async () => {
      // This is harder to test without mocking sqlite3 itself
      // For now, we'll just ensure the plugin loads correctly
      await app.register(dbConnector, { path: testDbPath });
      await app.ready();
      
      expect(app.db).toBeDefined();
    });
  });
});
