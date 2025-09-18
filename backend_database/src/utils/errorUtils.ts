export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

// Factory functions for common errors
export const errors = {
  validation: (message: string) =>
    new AppError(400, "VALIDATION_ERROR", message),
  notFound: (resource: string) =>
    new AppError(404, "NOT_FOUND", `${resource} not found`),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  internal: (message: string = "Internal server error") =>
    new AppError(500, "INTERNAL_ERROR", message),
  unauthorized: (message: string = "Unauthorized") =>
    new AppError(401, "UNAUTHORIZED", message),
};
