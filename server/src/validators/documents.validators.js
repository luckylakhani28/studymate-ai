import { z } from 'zod';
import { DOCUMENT_STATUS } from '../models/Document.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const page = z.coerce.number().int().min(1).default(1);

export const idParamSchema = { params: z.object({ id: objectId }) };

export const listSchema = {
  query: z.object({
    page,
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(DOCUMENT_STATUS).optional(),
    q: z.string().trim().max(100).optional(),
  }),
};

export const updateSchema = {
  params: z.object({ id: objectId }),
  body: z
    .strictObject({
      title: z.string().trim().min(1).max(200).optional(),
      tags: z
        .array(z.string().trim().toLowerCase().min(1).max(30))
        .max(10)
        .transform((tags) => [...new Set(tags)])
        .optional(),
    })
    .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update'),
};

export const chunksSchema = {
  params: z.object({ id: objectId }),
  query: z.object({ page, limit: z.coerce.number().int().min(1).max(50).default(20) }),
};
