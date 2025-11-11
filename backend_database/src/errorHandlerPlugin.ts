import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { AppError } from "./utils/errorUtils.ts";
import { ApiResponseHelper } from "./utils/responseUtils.ts";

async function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // Build structured log entry with rich context
    const logContext: Record<string, unknown> = {
      error: error.message,
      url: request.url,
      method: request.method,
      userId: request.user?.id,
      reqId: request.id, // Request ID for correlation
    };

    // Add error-specific context if available
    if (error instanceof AppError && error.context) {
      logContext.context = error.context;
      logContext.code = error.code;
    }

    // Log with full context for debugging
    // Note: reqId is also in log automatically via child logger, but we include it here for clarity
    fastify.log.error(logContext, "Request error occurred");

    // Handle Fastify validation errors
    if (error.validation) {
      reply.status(400);
      return ApiResponseHelper.error("VALIDATION_ERROR", error.message);
    }

    // Handle known errors
    if (error instanceof AppError) {
      reply.status(error.statusCode);
      return ApiResponseHelper.error(error.code, error.message);
    }

    // Unknown errors
    reply.status(500);
    return ApiResponseHelper.error("INTERNAL_ERROR", "Something went wrong");
  });
}

export default fp(errorHandler);
