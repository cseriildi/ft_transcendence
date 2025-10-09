import fastifyPlugin from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { AppError } from "../utils/errorUtils.js";

/**
 * Global error handler plugin for Fastify
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Log the error
    fastify.log.error(error);

    // Handle AppError instances
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // Handle validation errors
    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.validation,
        },
      });
    }

    // Handle generic errors
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;

    return reply.code(statusCode).send({
      success: false,
      error: {
        code: "ERROR",
        message,
      },
    });
  });
};

export default fastifyPlugin(errorHandlerPlugin);
