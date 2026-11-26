import type { z } from 'zod';
import { HttpError } from '../middleware/httpError.js';

/** Validates input or throws 400 VALIDATION_ERROR listing every issue. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request is invalid', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}
