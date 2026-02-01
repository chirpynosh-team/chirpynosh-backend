import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/AppError';

/**
 * Rate Limiter Middleware
 * Prevents abuse by limiting request frequency
 */

/**
 * Auth routes limiter - stricter for auth endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Too many requests, please try again later'));
  },
});

/**
 * General API limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Too many requests, please try again later'));
  },
});

/**
 * Strict limiter for sensitive operations
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Too many attempts, please try again later'));
  },
});
