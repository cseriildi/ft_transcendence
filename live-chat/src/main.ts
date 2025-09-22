import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { FastifyRequest } from "fastify";
import { SocketStream } from "@fastify/websocket";
import { sqlite3 } from "sqlite3";
import dbConnector from "./database.ts";
import { config, validateConfig } from "./config.ts";

validateConfig();

const fastify = Fastify({ logger: {level: config.logging.level} });
fastify.register(fastifyWebsocket);

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

interface User {
	username: string;
	socket: SocketStream["socket"];
}

const start = async () => {
  try {
	await fastify.register(dbConnector, { path: config.database.path });
    const port = process.env.PORT || 3002;
    await fastify.listen({ port: Number(port), host: '0.0.0.0' });
    console.log(`🚀 Live chat server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};