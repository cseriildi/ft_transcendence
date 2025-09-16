import fastify from "fastify";
import routes from "./routes/index.ts";
import dbConnector from "./database.ts";
import { config, validateConfig } from "./config.ts";
import errorHandler from "./plugins/errorHandler.ts";

// Validate configuration on startup
validateConfig();

const app = fastify({  logger: { level: config.logging.level } });

const start = async () => {
  try {
    await app.register(dbConnector, { path: config.database.path });
    await app.register(errorHandler);
    await app.register(routes);
    await app.listen({ port: config.server.port, host: config.server.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
