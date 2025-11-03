import fastify, { FastifyServerOptions } from "fastify";
import routes from "./routes/index.ts";
import dbConnector from "./database.ts";
import { config as appConfig, validateConfig } from "./config.ts";
import errorHandler from "./plugins/errorHandlerPlugin.ts";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";

// Validate configuration on startup
validateConfig();

export type BuildOptions = {
  logger?: boolean | FastifyServerOptions["logger"];
  database?: { path?: string };
  disableRateLimit?: boolean;
};

export async function build(opts: BuildOptions = {}) {
  const {
    logger = { level: appConfig.logging.level },
    database,
    disableRateLimit,
  } = opts;
  const app = fastify({ logger });

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
      root:
        appConfig.server.env === "production"
          ? "/app/uploads"
          : `${process.cwd()}/uploads`,
      prefix: "/uploads/",
      decorateReply: false,
    });

    await app.register(routes);

    return app;
  } catch (err) {
    app.log.error(err);
    throw err;
  }
}

const start = async () => {
  try {
    const app = await build();
    await app.listen({
      port: appConfig.server.port,
      host: appConfig.server.host,
    });
    if (appConfig.server.env === "development") {
      console.log(
        `📚 Swagger docs available at http://localhost:${appConfig.server.port}/docs`
      );
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
