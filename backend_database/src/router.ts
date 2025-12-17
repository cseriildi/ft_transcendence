import { FastifyInstance } from "fastify";
import userRoutes from "./services/userService/userRoutes.ts";
import authRoutes from "./services/authService/authRoutes.ts";
import monitoringRoutes from "./services/monitoringService/monitoringRoutes.ts";
import matchRoutes from "./services/matchService/matchRoutes.ts";
import twoFARoutes from "./services/2FAService/2FARoutes.ts";
import friendRoutes from "./services/friendService/friendRoutes.ts";
import gameInviteRoutes from "./services/gameInviteService/gameInviteRoutes.ts";
import { config } from "./config.ts";
import { authenticatedRateLimit } from "./middleware/rateLimitMiddleware.ts";

async function routes(fastify: FastifyInstance) {
  // Register monitoring and auth routes WITHOUT rate limiting middleware
  // (auth has its own specific rate limits in controllers)
  await Promise.all([
    fastify.register(monitoringRoutes),
    fastify.register(authRoutes, { prefix: config.routes.auth }),
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
        await apiInstance.register(gameInviteRoutes, { prefix: config.routes.api });
        await apiInstance.register(twoFARoutes, { prefix: config.routes.api });
      },
      { prefix: "" }
    ),
  ]);
}

export default routes;
