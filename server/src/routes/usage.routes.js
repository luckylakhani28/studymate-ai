import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { usageSchema } from '../validators/usage.validators.js';
import * as usageController from '../controllers/usage.controller.js';

export const usageRouter = Router();

usageRouter.get('/me', authenticate, validate(usageSchema), usageController.me);
