import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const rejectWithAppError = (_req, _res, next) => next(new AppError('RATE_LIMITED'));
const common = { standardHeaders: 'draft-7', legacyHeaders: false, handler: rejectWithAppError };
const byUser = (req) => req.user.id; // students on shared campus Wi-Fi share one IP

export const globalLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 300 });

// Brute-force protection: counts only FAILED attempts, so legitimate users are unaffected.
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  skip: () => isTest,
});

export const uploadLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: byUser,
  skip: () => isTest,
});

export const searchLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: byUser,
  skip: () => isTest,
});

// Paid AI work (study tools, chat messages): per user, so one account can't burn the API budget.
export const aiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: byUser,
  skip: () => isTest,
});
