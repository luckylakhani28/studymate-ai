import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { artifactIdSchema } from '../validators/artifacts.validators.js';
import * as artifactsController from '../controllers/artifacts.controller.js';

export const artifactsRouter = Router();

artifactsRouter.use(authenticate);
artifactsRouter.get('/:id', validate(artifactIdSchema), artifactsController.get);
artifactsRouter.delete('/:id', validate(artifactIdSchema), artifactsController.remove);
