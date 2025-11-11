import { createHandler } from "../../utils/handlerUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";

export const monitoringController = {
  /**
   * Health check endpoint - verifies service and database connectivity
   */
  getHealth: createHandler(async (request, { db }) => {
    try {
      // Test database connectivity
      await db.get("SELECT 1");

      return ApiResponseHelper.success(
        {
          message: "Welcome to the API",
          status: "healthy",
          database: "connected",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
        "Service is healthy"
      );
    } catch (error) {
      // Log error with context for debugging database connectivity issues
      request.log.error({ error, endpoint: "health-check" }, "Database health check failed");

      throw errors.internal("Service is unhealthy - database connection failed", {
        endpoint: "health-check",
        dbError: error instanceof Error ? error.message : String(error),
      });
    }
  }),
};
