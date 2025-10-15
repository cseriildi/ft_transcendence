import Fastify from "fastify";
import { config, validateConfig } from "./config.ts";
import dbConnector from "./database.ts";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { registerHttpRoutes } from "./routes/http.routes.ts";
import { registerWebSocketRoute } from "./routes/websocket.routes.ts";

validateConfig();

const app = Fastify({ logger: true });

// Register plugins
await app.register(import("@fastify/websocket"));
await app.register(rateLimit, {
  max: 5,
  timeWindow: "1 second",
});

await app.register(helmet, { global: true });
await app.register(dbConnector, { path: config.database.path });

await app.register(cors, {
  origin: ['http://localhost:4200', 'http://localhost:8080'],
  credentials: true
});

// Register routes
await app.register(registerHttpRoutes);
await app.register(registerWebSocketRoute);

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.server.port, host: config.server.host });
    console.log(
      `Server is running on ${config.server.host}:${config.server.port}`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
