import { FastifyInstance } from "fastify";
import { ApiResponseHelper } from "../utils/responseUtils.ts";
import { monitoringSchemas } from "./monitoringSchema.ts";

async function checkRoutes(fastify: FastifyInstance) {
  fastify.get("/health", {
    schema: {
      tags: ["health"],
      description: "Health check endpoint",
      ...monitoringSchemas.health
    }
  }, async (request, reply) => {
    return ApiResponseHelper.success(
      {
        message: "Welcome to the API",
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      "Service is healthy"
    );
  });
}

export default checkRoutes;
