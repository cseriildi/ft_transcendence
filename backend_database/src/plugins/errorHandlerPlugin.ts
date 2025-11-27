import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { AppError } from "../utils/errorUtils.ts";
import { ApiResponseHelper } from "../utils/responseUtils.ts";

async function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // Build structured log
    const logContext: Record<string, unknown> = {
      error: error.message,
      errorType: error.name || error.constructor.name,
      url: request.url,
      method: request.method,
      userId: request.user?.id,
      reqId: request.id,
    };

    // Handle Fastify validation errors (like schema validation)
    if (error.validation) {
      // Known validation error - no stack trace needed
      logContext.validation = error.validation;
      fastify.log.error(logContext, "Validation error occurred");
      reply.status(400);
      return ApiResponseHelper.error("VALIDATION_ERROR", error.message);
    }

    // Handle known AppError instances
    if (error instanceof AppError) {
      // Expected error with explicit handling - no stack trace needed
      logContext.context = error.context;
      logContext.code = error.code;
      fastify.log.error(logContext, "Application error occurred");
      reply.status(error.statusCode);
      return ApiResponseHelper.error(error.code, error.message);
    }

    // UNEXPECTED ERROR - Log full stack trace for debugging
    logContext.stack = error.stack;
    logContext.errorDetails = {
      name: error.name,
      message: error.message,
      // Include error cause if available (ES2022+ feature)
      ...(error.cause ? { cause: String(error.cause) } : {}),
    };
    fastify.log.error(logContext, "UNHANDLED ERROR - Stack trace included for debugging");

    // Return generic error to client (don't leak internals)
    reply.status(500);
    return ApiResponseHelper.error("INTERNAL_ERROR", "Something went wrong");
  });
}

export default fp(errorHandler);
