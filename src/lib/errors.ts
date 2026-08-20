/**
 * AppError — structured error with HTTP status + machine-readable code.
 * Thrown by services/route handlers and mapped to JSON responses.
 */
export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }

  static badRequest(message = "Bad request", code = "BAD_REQUEST") {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED") {
    return new AppError(message, 401, code);
  }

  static forbidden(message = "Forbidden", code = "FORBIDDEN") {
    return new AppError(message, 403, code);
  }

  static notFound(message = "Not found", code = "NOT_FOUND") {
    return new AppError(message, 404, code);
  }

  static conflict(message = "Conflict", code = "CONFLICT") {
    return new AppError(message, 409, code);
  }
}

/**
 * Normalize any thrown value into an AppError.
 * Zod validation errors map to 400 (not 500).
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    if (err.name === "ZodError") {
      return new AppError(err.message, 400, "VALIDATION_ERROR");
    }
    return new AppError(err.message, 500, "INTERNAL_ERROR");
  }
  return new AppError("Unknown error", 500, "INTERNAL_ERROR");
}
