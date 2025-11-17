import { FastifyInstance } from "fastify";
import { build } from "../src/main.ts";
import { promises as fs } from "fs";
import path from "path";
import { DatabaseHelper } from "../src/utils/databaseUtils.ts";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await build({
    logger: false,
    database: { path: ":memory:" },
    disableRateLimit: true,
  });
  return app;
}

export async function cleanupTestApp(app: FastifyInstance): Promise<void> {
  if (app) {
    await app.close();
  }
  // Clean up uploaded avatars after tests
  await cleanupTestAvatars();
}

export async function cleanupTestAvatars(): Promise<void> {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
    const files = await fs.readdir(uploadsDir);

    // Delete all files except the default folder and its contents
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);

      try {
        const stat = await fs.stat(filePath);

        // Skip the 'default' directory
        if (stat.isDirectory() && file === "default") {
          continue;
        }

        // Delete uploaded avatar files (not directories)
        if (stat.isFile()) {
          await fs.unlink(filePath);
        }
      } catch {
        // File might have been already deleted, skip it
        continue;
      }
    }
  } catch {
    // Silently fail if uploads directory doesn't exist or other errors
    // This is expected in test environments
  }
}

/**
 * Reset database to clean state between tests
 *
 * Uses DatabaseHelper for clean async/await instead of callback nesting.
 * Deletes in reverse dependency order to respect foreign key constraints:
 * 1. refresh_tokens (depends on users)
 * 2. friends (depends on users)
 * 3. matches (depends on users)
 * 4. avatars (depends on users)
 * 5. users (root table)
 *
 * Alternative approach: Could use PRAGMA foreign_keys = OFF to allow
 * deleting users first (cascades automatically), but explicit order is
 * more readable and safer.
 */
export async function resetDatabase(app: FastifyInstance): Promise<void> {
  const db = new DatabaseHelper(app.db);

  // Delete in reverse dependency order (child tables first, then parent)
  await db.run("DELETE FROM refresh_tokens");
  await db.run("DELETE FROM friends");
  await db.run("DELETE FROM matches");
  await db.run("DELETE FROM avatars");
  await db.run("DELETE FROM users");

  // Clean up uploaded avatar files
  await cleanupTestAvatars();
}
