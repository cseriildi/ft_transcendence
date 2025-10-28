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

  // All routes use their configured prefixes
  await fastify.register(authRoutes, { prefix: config.routes.auth });
  await fastify.register(oauthRoutes, { prefix: config.routes.oauth });
  await fastify.register(userRoutes, { prefix: config.routes.api });
  await fastify.register(matchRoutes, { prefix: config.routes.api });
  await fastify.register(friendRoutes, { prefix: config.routes.api });
}

export default routes;
