import { z } from 'zod';
import { objectId } from './documents.validators.js';

export const searchSchema = {
  body: z.strictObject({
    query: z.string().trim().min(2).max(500),
    documentIds: z.array(objectId).min(1).max(20).optional(),
    limit: z.number().int().min(1).max(20).default(6),
    mode: z.enum(['hybrid', 'vector', 'keyword']).default('hybrid'),
  }),
};
