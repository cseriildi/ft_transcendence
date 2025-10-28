import { FastifyInstance } from "fastify";
import userRoutes from "../services/userService/userRoutes.ts";
import authRoutes from "../services/authService/authRoutes.ts";
import checkRoutes from "./healthRoutes.ts";
import matchRoutes from "../services/matchService/matchRoutes.ts";
import oauthRoutes from "../services/oAuthService/oAuthRoutes.ts";
import { config } from "../config.ts";
import friendRoutes from "../services/friendService/friendRoutes.ts";

async function routes(fastify: FastifyInstance) {
  await fastify.register(checkRoutes);

  await fastify.register(authRoutes, { prefix: config.routes.auth });
  await fastify.register(oauthRoutes, { prefix: config.routes.oauth });
  // API routes are registered without prefix since nginx strips /api before proxying
  await fastify.register(userRoutes);
  await fastify.register(matchRoutes);
  await fastify.register(friendRoutes);
}

export default routes;
