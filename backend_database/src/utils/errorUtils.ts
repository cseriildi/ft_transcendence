import { FastifyRequest } from "fastify";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Factory functions for common errors
export const errors = {
  validation: (message: string, context?: Record<string, unknown>) =>
    new AppError(400, "VALIDATION_ERROR", message, context),
  notFound: (resource: string, context?: Record<string, unknown>) =>
    new AppError(404, "NOT_FOUND", `${resource} not found`, context),
  conflict: (message: string, context?: Record<string, unknown>) =>
    new AppError(409, "CONFLICT", message, context),
  internal: (message = "Internal server error", context?: Record<string, unknown>) =>
    new AppError(500, "INTERNAL_ERROR", message, context),
  unauthorized: (message = "Unauthorized", context?: Record<string, unknown>) =>
    new AppError(401, "UNAUTHORIZED", message, context),
  forbidden: (message = "Forbidden", context?: Record<string, unknown>) =>
    new AppError(403, "FORBIDDEN", message, context),
};

// Request-aware error factory (auto-injects userId, endpoint, reqId)
export function requestErrors(request: FastifyRequest) {
  const baseContext = {
    userId: request.user?.id,
    endpoint: request.url,
    reqId: request.id,
  };

  return {
    validation: (message: string, context?: Record<string, unknown>): AppError =>
      errors.validation(message, { ...baseContext, ...context }),

    notFound: (resource: string, context?: Record<string, unknown>): AppError =>
      errors.notFound(resource, { ...baseContext, ...context }),

    conflict: (message: string, context?: Record<string, unknown>): AppError =>
      errors.conflict(message, { ...baseContext, ...context }),

    unauthorized: (message?: string, context?: Record<string, unknown>): AppError =>
      errors.unauthorized(message, { ...baseContext, ...context }),

    forbidden: (message?: string, context?: Record<string, unknown>): AppError =>
      errors.forbidden(message, { ...baseContext, ...context }),

    internal: (message?: string, context?: Record<string, unknown>): AppError =>
      errors.internal(message, { ...baseContext, ...context }),
  };
}
