import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { searchLimiter } from '../middleware/rateLimiters.js';
import { searchSchema } from '../validators/search.validators.js';
import * as searchController from '../controllers/search.controller.js';

export const searchRouter = Router();

searchRouter.post(
  '/',
  authenticate,
  searchLimiter,
  validate(searchSchema),
  searchController.search,
);
