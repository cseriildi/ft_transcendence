import { FastifyInstance } from "fastify";
import { monitoringController } from "./monitoringController.ts";
import { monitoringSchemas } from "./monitoringSchemas.ts";

async function monitoringRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        description: "Health check endpoint - verifies service and database connectivity",
        ...monitoringSchemas.health,
      },
    },
    monitoringController.getHealth
  );
}

export default monitoringRoutes;
