import { FastifyInstance } from "fastify";
import { ApiResponseHelper } from "../utils/responseUtils.ts";

async function checkRoutes(fastify: FastifyInstance) {
  fastify.get("/", {
    schema: {
      tags: ["health"],
      description: "Welcome endpoint",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" },
                version: { type: "string" }
              }
            },
            message: { type: "string" },
            timestamp: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    return ApiResponseHelper.success(
      {
        message: "Welcome to the API",
        version: "1.0.0",
      },
      "API is running"
    );
  });

  fastify.get("/health", {
    schema: {
      tags: ["health"],
      description: "Health check endpoint",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                status: { type: "string" },
                timestamp: { type: "string" },
                uptime: { type: "number" }
              }
            },
            message: { type: "string" },
            timestamp: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    return ApiResponseHelper.success(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      "Service is healthy"
    );
  });
}

export default checkRoutes;
