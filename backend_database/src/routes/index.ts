import { FastifyInstance } from "fastify";
import userRoutes from "./users.ts";
import checkRoutes from "./healthChecks.ts";

async function routes(fastify: FastifyInstance) {
  // Register user routes
  await fastify.register(checkRoutes);
  await fastify.register(userRoutes);
}

export default routes;
