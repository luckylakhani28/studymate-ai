import { Router } from 'express';
import { isDBConnected } from '../config/db.js';
import { ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  if (!isDBConnected()) {
    throw new AppError('SERVICE_UNAVAILABLE', { message: 'Database unavailable' });
  }
  ok(res, { status: 'ok', db: 'connected', uptime: Math.round(process.uptime()) });
});
