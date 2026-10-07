import { AppError } from '../utils/AppError.js';

export const notFound = (req, _res, next) =>
  next(new AppError('NOT_FOUND', { message: `Route ${req.method} ${req.originalUrl} not found` }));
