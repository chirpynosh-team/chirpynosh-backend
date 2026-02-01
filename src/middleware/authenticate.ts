import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import type { TokenPayload } from '../types/auth.types';

/**
 * Authentication Middleware
 * Protects routes by verifying JWT access tokens
 */

/**
 * Extract token from request
 * Checks cookies first, then Authorization header
 */
const extractToken = (req: Request): string | null => {
  // Check cookies first
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken as string;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

/**
 * Authenticate middleware
 * Verifies JWT and attaches user to request
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req);

    if (!token) {
      throw AppError.unauthorized('Access token is required', 'NO_TOKEN');
    }

    try {
      const payload = verifyAccessToken(token);

      if (payload.type !== 'access') {
        throw AppError.unauthorized('Invalid token type', 'INVALID_TOKEN_TYPE');
      }

      // Attach user to request
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // JWT verification failed
      throw AppError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
    }
  }
);

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req);

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        if (payload.type === 'access') {
          req.user = payload;
        }
      } catch {
        // Token invalid, continue without user
      }
    }

    next();
  }
);

/**
 * Authorization middleware
 * Checks if user has required role
 */
export const authorize = (...roles: TokenPayload['role'][]) => {
  return asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      if (!roles.includes(req.user.role)) {
        throw AppError.forbidden('Insufficient permissions', 'FORBIDDEN');
      }

      next();
    }
  );
};
