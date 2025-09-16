import { FastifyInstance } from "fastify";
import userRoutes from "./userRoutes.ts";
import checkRoutes from "./healthRoutes.ts";

async function routes(fastify: FastifyInstance) {
  // Register user routes
  await fastify.register(checkRoutes);
  await fastify.register(userRoutes);
}

export default routes;
