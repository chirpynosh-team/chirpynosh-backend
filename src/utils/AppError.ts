/**
 * Custom Application Error
 * Used for operational errors with proper status codes
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string | undefined;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: { isOperational?: boolean; code?: string }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.code = options?.code;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Factory methods for common error types
   */
  static badRequest(message: string, code?: string): AppError {
    return new AppError(message, 400, code ? { code } : undefined);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string): AppError {
    return new AppError(message, 401, code ? { code } : undefined);
  }

  static forbidden(message: string = 'Forbidden', code?: string): AppError {
    return new AppError(message, 403, code ? { code } : undefined);
  }

  static notFound(message: string = 'Resource not found', code?: string): AppError {
    return new AppError(message, 404, code ? { code } : undefined);
  }

  static conflict(message: string, code?: string): AppError {
    return new AppError(message, 409, code ? { code } : undefined);
  }

  static tooManyRequests(message: string = 'Too many requests', code?: string): AppError {
    return new AppError(message, 429, code ? { code } : undefined);
  }

  static internal(message: string = 'Internal server error', code?: string): AppError {
    return new AppError(message, 500, { isOperational: false, ...(code && { code }) });
  }
}
