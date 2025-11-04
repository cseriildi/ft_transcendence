export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Factory functions for common errors
export const errors = {
  validation: (message: string) => new AppError(400, "VALIDATION_ERROR", message),
  notFound: (message: string) => new AppError(404, "NOT_FOUND", `${message} not found`),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  internal: (message = "Internal server error") => new AppError(500, "INTERNAL_ERROR", message),
  unauthorized: (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Forbidden") => new AppError(403, "FORBIDDEN", message),
};
