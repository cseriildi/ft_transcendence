import { FastifyReply } from "fastify";

/**
 * Standard success response format
 */
export const successResponse = <T>(reply: FastifyReply, data: T, statusCode: number = 200) => {
  return reply.code(statusCode).send({
    success: true,
    data,
  });
};

/**
 * Standard error response format
 */
export const errorResponse = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
) => {
  return reply.code(statusCode).send({
    success: false,
    error: {
      code,
      message,
    },
  });
};
