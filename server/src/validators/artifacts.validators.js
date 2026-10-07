import { z } from 'zod';
import { ARTIFACT_TYPES } from '../models/StudyArtifact.js';
import { objectId } from './documents.validators.js';

const params = z.object({ id: objectId });

export const createArtifactSchema = {
  params,
  body: z.strictObject({
    type: z.enum(ARTIFACT_TYPES),
    options: z.record(z.string(), z.unknown()).default({}), // validated per type by ARTIFACT_SPECS
    regenerate: z.boolean().default(false),
  }),
};

export const listArtifactsSchema = {
  params,
  query: z.object({
    type: z.enum(ARTIFACT_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  }),
};

export const artifactIdSchema = { params };
