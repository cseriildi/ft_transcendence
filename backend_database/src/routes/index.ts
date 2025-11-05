import { FastifyInstance } from "fastify";
import userRoutes from "../services/userService/userRoutes.ts";
import authRoutes from "../services/authService/authRoutes.ts";
import checkRoutes from "./healthRoutes.ts";
import matchRoutes from "../services/matchService/matchRoutes.ts";
import oauthRoutes from "../services/oAuthService/oAuthRoutes.ts";
import { config } from "../config.ts";
import friendRoutes from "../services/friendService/friendRoutes.ts";

async function routes(fastify: FastifyInstance) {
  // Register all routes in parallel for faster startup
  // Routes are independent and don't need to wait for each other
  await Promise.all([
    fastify.register(checkRoutes),
    fastify.register(authRoutes, { prefix: config.routes.auth }),
    fastify.register(oauthRoutes, { prefix: config.routes.oauth }),
    fastify.register(userRoutes, { prefix: config.routes.api }),
    fastify.register(matchRoutes, { prefix: config.routes.api }),
    fastify.register(friendRoutes, { prefix: config.routes.api }),
  ]);
}

export default routes;
