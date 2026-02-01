import type { TokenPayload } from './auth.types';

/**
 * Express Module Augmentation
 * Extends the Express Request interface to include user property
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
