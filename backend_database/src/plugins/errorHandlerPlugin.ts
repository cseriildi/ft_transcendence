import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { AppError } from "../utils/errorUtils.ts";
import { ApiResponseHelper } from "../utils/responseUtils.ts";

async function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // Log error with minimal context
    fastify.log.error({
      error: error.message,
      url: request.url,
      method: request.method,
    });

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
