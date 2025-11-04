import { FastifyInstance } from "fastify";
import { build } from "../src/main.ts";
import { promises as fs } from "fs";
import path from "path";

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
      } catch (err) {
        // File might have been already deleted, skip it
        continue;
      }
    }
  } catch (error) {
    // Silently fail if uploads directory doesn't exist or other errors
    // This is expected in test environments
  }
}

export async function resetDatabase(app: FastifyInstance): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    app.db.run("DELETE FROM refresh_tokens", [], (err) => {
      if (err) return reject(err);
      app.db.run("DELETE FROM friends", [], (err2) => {
        if (err2) return reject(err2);
        app.db.run("DELETE FROM matches", [], (err3) => {
          if (err3) return reject(err3);
          app.db.run("DELETE FROM avatars", [], (err4) => {
            if (err4) return reject(err4);
            app.db.run("DELETE FROM users", [], (err5) => (err5 ? reject(err5) : resolve()));
          });
        });
      });
    });
  });
  // Clean up uploaded avatar files
  await cleanupTestAvatars();
}
