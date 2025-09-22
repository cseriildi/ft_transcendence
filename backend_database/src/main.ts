import fastify from "fastify";
import routes from "./routes/index.ts";
import dbConnector from "./database.ts";
import { config, validateConfig } from "./config.ts";
import errorHandler from "./plugins/errorHandlerPlugin.ts";
import rateLimit from "@fastify/rate-limit";

// Validate configuration on startup
validateConfig();

const app = fastify({  logger: { level: config.logging.level } });

export async function build(opts = {}) {
  const app = fastify({logger:  {level: config.logging.level}});

  try {
    await app.register(rateLimit, { max: 5, timeWindow: "1 second" });
    await app.register(dbConnector, { path: config.database.path });
    await app.register(errorHandler);
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
    await app.listen({ port: config.server.port, host: config.server.host });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}