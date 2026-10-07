import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { formatZodIssues } from './validate.js';

/** Map any thrown value to an AppError. Unknown errors become a generic 500. */
function normalize(err) {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('FILE_TOO_LARGE', {
        message: `Files must be ${env.MAX_UPLOAD_MB} MB or smaller`,
      });
    }
    return new AppError('VALIDATION_ERROR', {
      message: 'Invalid upload',
      details: [{ field: err.field ?? 'file', message: err.message }],
    });
  }
  if (err instanceof ZodError) {
    return new AppError('VALIDATION_ERROR', { details: formatZodIssues(err.issues) });
  }
  if (err instanceof mongoose.Error.CastError) {
    return new AppError('INVALID_ID', { details: [{ field: err.path, message: 'Invalid id' }] });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new AppError('VALIDATION_ERROR', { details });
  }
  if (err?.code === 11000) {
    const details = Object.keys(err.keyValue ?? {}).map((field) => ({
      field,
      message: 'Already exists',
    }));
    return new AppError('CONFLICT', { details });
  }
  if (err?.type === 'entity.parse.failed') return new AppError('INVALID_JSON');
  if (err?.type === 'entity.too.large') return new AppError('PAYLOAD_TOO_LARGE');
  return new AppError('INTERNAL_ERROR', { cause: err });
}

// Express identifies error middleware by its 4 arguments — keep `next`.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const appErr = normalize(err);
  if (appErr.status >= 500) res.err = err; // pino-http logs the original error + stack

  res.status(appErr.status).json({
    success: false,
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details && { details: appErr.details }),
    },
    requestId: req.id,
  });
}
