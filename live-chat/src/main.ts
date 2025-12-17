import Fastify from "fastify";
import { config, validateConfig } from "./config.js";
import dbConnector from "./database.js";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { registerHttpRoutes } from "./routes/http.routes.js";
import { registerWebSocketRoute } from "./routes/websocket.routes.js";

validateConfig();

const app = Fastify({ logger: true });

// Register plugins
await app.register(import("@fastify/websocket"));
await app.register(import("./plugins/prometheusPlugin.js"));
await app.register(rateLimit, {
  max: 5,
  timeWindow: "1 second",
});

await app.register(helmet, { global: true });
await app.register(dbConnector, { path: config.database.path });

await app.register(cors, {
  origin: config.cors.origins,
  credentials: true,
});

// Preload ban list from database
import { preloadBanList } from "./database.js";
import { banList } from "./services/state.js";

try {
  const loadedBans = await preloadBanList(app.db);
  loadedBans.forEach((bans, userId) => {
    banList.set(userId, bans);
  });
  app.log.info(`Preloaded ${loadedBans.size} users with ban lists`);
} catch (err) {
  app.log.error("Failed to preload ban list: %s", err);
  process.exit(1);
}

// Register routes
await app.register(registerHttpRoutes);
await app.register(registerWebSocketRoute);

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.server.port, host: config.server.host });
    console.log(`Server is running on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
