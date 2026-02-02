import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Zod Validation Middleware Factory
 * Creates middleware that validates request body against a Zod schema
 * Note: For 'query' validation, we only validate but don't replace since req.query is read-only
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

    // For body and params, we can replace with parsed/transformed data
    // For query, req.query is read-only in newer Express versions, so we skip assignment
    // The validated data is available from the schema parsing above
    if (target === 'body') {
      req.body = result.data;
    }
    // Note: params and query are typically read-only getters,
    // so we just validate without replacement
    
    next();
  };
};
