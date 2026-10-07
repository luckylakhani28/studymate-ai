import { AppError } from '../utils/AppError.js';

export const formatZodIssues = (issues, prefix) =>
  issues.map((issue) => ({
    field: [prefix, ...issue.path].filter((p) => p !== undefined && p !== '').join('.'),
    message: issue.message,
  }));

/**
 * validate({ params, query, body }) — each a zod schema.
 * Parsed values land on req.validated (Express 5 makes req.query read-only).
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const details = [];

    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) validated[part] = result.data;
      else details.push(...formatZodIssues(result.error.issues, part));
    }

    if (details.length) return next(new AppError('VALIDATION_ERROR', { details }));
    req.validated = validated;
    next();
  };
}
