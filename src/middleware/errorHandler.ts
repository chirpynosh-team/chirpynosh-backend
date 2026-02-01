import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import type { ApiErrorResponse } from '../types/api.types';

/**
 * Central Error Handler Middleware
 * Handles all errors and sends consistent JSON responses
 */

interface PrismaError extends Error {
  code?: string;
  meta?: { target?: string[] };
}

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

const handlePrismaError = (err: PrismaError): AppError => {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const field = err.meta?.target?.[0] ?? 'field';
      return AppError.conflict(`A record with this ${field} already exists`);
    case 'P2025':
      // Record not found
      return AppError.notFound('Record not found');
    case 'P2003':
      // Foreign key constraint
      return AppError.badRequest('Invalid reference');
    default:
      return AppError.internal('Database error');
  }
};

const handleZodError = (err: ZodError): AppError => {
  const issues = err.issues as ZodIssue[];
  const errors = issues.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
  const message = errors.map((e) => `${e.field}: ${e.message}`).join(', ');
  return AppError.badRequest(message, 'VALIDATION_ERROR');
};

const handleJwtError = (err: Error): AppError => {
  if (err.name === 'TokenExpiredError') {
    return AppError.unauthorized('Token has expired', 'TOKEN_EXPIRED');
  }
  if (err.name === 'JsonWebTokenError') {
    return AppError.unauthorized('Invalid token', 'INVALID_TOKEN');
  }
  return AppError.unauthorized('Authentication failed');
};

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error in development
  if (env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  let error: AppError;

  // Handle known error types
  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = handleZodError(err);
  } else if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    error = handleJwtError(err);
  } else if ('code' in err && typeof (err as PrismaError).code === 'string') {
    error = handlePrismaError(err as PrismaError);
  } else {
    // Unknown error - log and send generic message
    console.error('Unhandled error:', err);
    error = AppError.internal(
      env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    );
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      ...(env.NODE_ENV === 'development' && { details: err.stack }),
    },
  };

  res.status(error.statusCode).json(response);
};
