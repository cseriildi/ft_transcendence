import { FastifyInstance } from "fastify";
import userRoutes from "../userService/userRoutes.ts";
import checkRoutes from "./healthRoutes.ts";
import matchRoutes from "./matchRoutes.ts";

async function routes(fastify: FastifyInstance) {
  // Register user routes
  await fastify.register(checkRoutes);
  await fastify.register(userRoutes);
  await fastify.register(matchRoutes)
}

export default routes;
