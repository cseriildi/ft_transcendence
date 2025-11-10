import { FastifyInstance } from "fastify";
import userRoutes from "../services/userService/userRoutes.ts";
import authRoutes from "../services/authService/authRoutes.ts";
import checkRoutes from "./healthRoutes.ts";
import matchRoutes from "../services/matchService/matchRoutes.ts";
import oauthRoutes from "../services/oAuthService/oAuthRoutes.ts";
import { config } from "../config.ts";
import friendRoutes from "../services/friendService/friendRoutes.ts";
import { authenticatedRateLimit } from "../middleware/rateLimitMiddleware.ts";

async function routes(fastify: FastifyInstance) {
  // Register health and auth routes WITHOUT rate limiting middleware
  // (they have their own specific rate limits in controllers)
  await Promise.all([
    fastify.register(checkRoutes),
    fastify.register(authRoutes, { prefix: config.routes.auth }),
    fastify.register(oauthRoutes, { prefix: config.routes.oauth }),
  ]);

  // Register API routes WITH per-user rate limiting (100 req/min)
  // This applies to authenticated endpoints after requireAuth middleware
  await Promise.all([
    fastify.register(
      async (apiInstance) => {
        // Apply rate limit middleware to all routes in this instance
        apiInstance.addHook("onRequest", authenticatedRateLimit);

        // Register API routes
        await apiInstance.register(userRoutes, { prefix: config.routes.api });
        await apiInstance.register(matchRoutes, { prefix: config.routes.api });
        await apiInstance.register(friendRoutes, { prefix: config.routes.api });
      },
      { prefix: "" }
    ),
  ]);
}

export default routes;
