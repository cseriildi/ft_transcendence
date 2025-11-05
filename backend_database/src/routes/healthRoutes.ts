import { FastifyInstance } from "fastify";
import { ApiResponseHelper } from "../utils/responseUtils.ts";
import { monitoringSchemas } from "./monitoringSchema.ts";

async function checkRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        description: "Health check endpoint",
        ...monitoringSchemas.health,
      },
    },
    async (_request, reply) => {
      try {
        await fastify.db.get("SELECT 1");

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
      } catch {
        return reply
          .code(503)
          .send(
            ApiResponseHelper.error(
              "SERVICE_UNAVAILABLE",
              "Service is unhealthy - database connection failed"
            )
          );
      }
    }
  );
}

export default checkRoutes;
