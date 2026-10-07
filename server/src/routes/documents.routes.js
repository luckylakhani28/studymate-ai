import { Router } from 'express';
import * as documentsController from '../controllers/documents.controller.js';
import * as artifactsController from '../controllers/artifacts.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimiters.js';
import { uploadPdf } from '../middleware/uploadPdf.js';
import {
  chunksSchema,
  idParamSchema,
  listSchema,
  updateSchema,
} from '../validators/documents.validators.js';
import { createArtifactSchema, listArtifactsSchema } from '../validators/artifacts.validators.js';

export const documentsRouter = Router();

// Auth runs BEFORE multer: unauthenticated uploads are rejected before a single byte hits disk.
documentsRouter.use(authenticate);

documentsRouter.post('/', uploadLimiter, uploadPdf, documentsController.upload);
documentsRouter.get('/', validate(listSchema), documentsController.list);
documentsRouter.get('/:id', validate(idParamSchema), documentsController.get);
documentsRouter.get('/:id/status', validate(idParamSchema), documentsController.status);
documentsRouter.get('/:id/file', validate(idParamSchema), documentsController.file);
documentsRouter.get('/:id/chunks', validate(chunksSchema), documentsController.chunks);
documentsRouter.patch('/:id', validate(updateSchema), documentsController.update);
documentsRouter.post(
  '/:id/reprocess',
  uploadLimiter,
  validate(idParamSchema),
  documentsController.reprocess,
);
documentsRouter.delete('/:id', validate(idParamSchema), documentsController.remove);

documentsRouter.post(
  '/:id/artifacts',
  aiLimiter,
  validate(createArtifactSchema),
  artifactsController.create,
);
documentsRouter.get('/:id/artifacts', validate(listArtifactsSchema), artifactsController.list);
