import { FastifyInstance } from "fastify";
import userRoutes from "../services/userService/userRoutes.ts";
import authRoutes from "../services/authService/authRoutes.ts";
import checkRoutes from "./healthRoutes.ts";
import matchRoutes from "../services/matchService/matchRoutes.ts";
import oauthRoutes from "../services/oAuthService/oAuthRoutes.ts";

async function routes(fastify: FastifyInstance) {
  // Register user routes
  await fastify.register(checkRoutes);
  await fastify.register(userRoutes);
  await fastify.register(matchRoutes);
  await fastify.register(authRoutes);
  await fastify.register(oauthRoutes);
}

export default routes;
