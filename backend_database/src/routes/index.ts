import { FastifyInstance } from "fastify";
import userRoutes from "../userService/userRoutes.ts";
import authRoutes from "../authService/authRoutes.ts";
import checkRoutes from "./healthRoutes.ts";
import matchRoutes from "../matchService/matchRoutes.ts";

async function routes(fastify: FastifyInstance) {
  // Register user routes
  await fastify.register(checkRoutes);
  await fastify.register(userRoutes);
  await fastify.register(matchRoutes);
  await fastify.register(authRoutes);
}

export default routes;
