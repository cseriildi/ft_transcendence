import fastify, { FastifyServerOptions } from "fastify";
import routes from "./routes/index.ts";
import dbConnector from "./database.ts";
import { config as appConfig, validateConfig } from "./config.ts";
import errorHandler from "./plugins/errorHandlerPlugin.ts";
import rateLimit from "@fastify/rate-limit";

// Validate configuration on startup
validateConfig();

export type BuildOptions = {
  logger?: boolean | FastifyServerOptions["logger"];
  database?: { path?: string };
  disableRateLimit?: boolean;
};

export async function build(opts: BuildOptions = {}) {
  const { logger = { level: appConfig.logging.level }, database, disableRateLimit } = opts;
  const app = fastify({ logger });

  try {
    if (!disableRateLimit) {
      await app.register(rateLimit, { max: 5, timeWindow: "1 second" });
    }
    await app.register(dbConnector, { path: database?.path ?? appConfig.database.path });
    await app.register(errorHandler);
    await app.register(import("@fastify/cookie")); // Add this line
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
    await app.listen({ port: appConfig.server.port, host: appConfig.server.host });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}