import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Zod Validation Middleware Factory
 * Creates middleware that validates request body against a Zod schema
 */

type ValidationTarget = 'body' | 'query' | 'params';

export const validate = <T extends z.ZodTypeAny>(
  schema: T,
  target: ValidationTarget = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      // Pass Zod error to error handler
      next(result.error);
      return;
    }

    // Replace the target with parsed/transformed data
    req[target] = result.data;
    next();
  };
};
