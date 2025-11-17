// CRITICAL: Polyfill crypto for jose library BEFORE any other imports
import nodeCrypto from "node:crypto";
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}

import fastify, { FastifyServerOptions } from "fastify";
import router from "./router.ts";
import dbConnector from "./plugins/databasePlugin.ts";
import { config as appConfig } from "./config.ts";
import errorHandler from "./plugins/errorHandlerPlugin.ts";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";

export type BuildOptions = {
  logger?: boolean | FastifyServerOptions["logger"];
  database?: { path?: string };
  disableRateLimit?: boolean;
};

/**
 * Generates a unique request ID
 * Format: req-{timestamp}-{random} for easy chronological sorting
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36); // Base36 timestamp (shorter)
  const random = randomBytes(4).toString("hex"); // 8 char random
  return `req-${timestamp}-${random}`;
}

export async function build(opts: BuildOptions = {}) {
  const {
    logger = {
      level: appConfig.logging.level,
      // Structured logging for production
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
            userId: request.user?.id, // Include authenticated user ID in logs
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
      },
      // Pretty print in development, JSON in production
      transport:
        appConfig.server.env === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
                colorize: true,
              },
            }
          : undefined,
    },
    database,
    disableRateLimit,
  } = opts;

  const app = fastify({
    logger,
    // Custom request ID generation for distributed tracing
    // Uses client-provided ID (x-request-id header) or generates unique ID
    genReqId: (req) => {
      const clientId = req.headers["x-request-id"];
      if (typeof clientId === "string" && clientId.length > 0) {
        return clientId;
      }
      return generateRequestId();
    },
    // Automatically set response header with request ID
    requestIdHeader: "x-request-id",
    // Use 'reqId' as log property name for consistency
    requestIdLogLabel: "reqId",
  });

  await app.register(cors, {
    origin: appConfig.cors.origins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  try {
    //-------------------------------- Swagger Setup --------------------------------
    if (appConfig.server.env === "development") {
      const publicPort = appConfig.server.publicPort || appConfig.server.port;
      const swaggerUrl = `${appConfig.server.publicHost}:${publicPort}`;

      await app.register(import("@fastify/swagger"), {
        openapi: {
          info: {
            title: "Fastify API",
            description: "API documentation for Fastify backend",
            version: "1.0.0",
          },
          servers: [
            {
              url: `http://${swaggerUrl}`,
              description: "Development server",
            },
          ],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
              },
            },
          },
          tags: [
            { name: "health", description: "Health check endpoints" },
            { name: "auth", description: "Authentication endpoints" },
            { name: "oauth", description: "OAuth (GitHub) endpoints" },
            { name: "users", description: "User management endpoints" },
            { name: "matches", description: "Match endpoints" },
          ],
        },
      });

      await app.register(import("@fastify/swagger-ui"), {
        routePrefix: "/docs",
        uiConfig: {
          docExpansion: "list",
          deepLinking: true,
        },
        staticCSP: true,
      });
    }
    //------------------------------------

    if (!disableRateLimit) {
      await app.register(rateLimit, { max: 20, timeWindow: "1 second" });
    }

    await app.register(dbConnector, {
      path: database?.path ?? appConfig.database.path,
    });
    await app.register(errorHandler);
    await app.register(import("@fastify/cookie"));

    // Register multipart for file uploads
    await app.register(import("@fastify/multipart"), {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
        files: 1, // Max 1 file per request
      },
    });

    // Register static file serving for uploaded avatars
    await app.register(import("@fastify/static"), {
      root: appConfig.server.env === "production" ? "/app/uploads" : `${process.cwd()}/uploads`,
      prefix: "/uploads/",
      decorateReply: false,
    });

    await app.register(router);

    return app;
  } catch (err) {
    app.log.error(err);
    throw err;
  }
}

const start = async () => {
  let app: Awaited<ReturnType<typeof build>> | undefined;
  try {
    app = await build();
    await app.listen({
      port: appConfig.server.port,
      host: appConfig.server.host,
    });
    if (appConfig.server.env === "development") {
      app.log.info(`📚 Swagger docs available at http://localhost:${appConfig.server.port}/docs`);
    }

    // Graceful shutdown handlers for production environments
    // Docker/K8s send SIGTERM before force-killing the container
    const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (!app) return; // Should never happen, but TypeScript safety
        app.log.info({ signal }, `Received ${signal}, closing server gracefully...`);
        try {
          // Fastify's close() method:
          // 1. Stops accepting new connections
          // 2. Waits for in-flight requests to complete
          // 3. Triggers onClose hooks (closes DB connection via databasePlugin)
          await app.close();
          app.log.info("Server closed gracefully");
          process.exit(0);
        } catch (err) {
          app.log.error({ err }, "Error during graceful shutdown");
          process.exit(1);
        }
      });
    });
  } catch (err) {
    if (app) {
      app.log.error(err, "Failed to start server");
    } else {
      // Fallback if app failed to build
      // eslint-disable-next-line no-console
      console.error("Failed to build application:", err);
    }
    process.exit(1);
  }
};

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void start(); // Explicitly mark as fire-and-forget :
  // errors are handled inside start() and will exit the process
}
