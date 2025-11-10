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
  notFound: (message: string, context?: Record<string, unknown>) =>
    new AppError(404, "NOT_FOUND", `${message} not found`, context),
  conflict: (message: string, context?: Record<string, unknown>) =>
    new AppError(409, "CONFLICT", message, context),
  internal: (message = "Internal server error", context?: Record<string, unknown>) =>
    new AppError(500, "INTERNAL_ERROR", message, context),
  unauthorized: (message = "Unauthorized", context?: Record<string, unknown>) =>
    new AppError(401, "UNAUTHORIZED", message, context),
  forbidden: (message = "Forbidden", context?: Record<string, unknown>) =>
    new AppError(403, "FORBIDDEN", message, context),
};
