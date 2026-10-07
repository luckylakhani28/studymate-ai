import { z } from 'zod';
import { objectId } from './documents.validators.js';

const params = z.object({ id: objectId });
const title = z.string().trim().min(1).max(120);

export const createConversationSchema = {
  body: z.strictObject({ documentIds: z.array(objectId).min(1).max(10), title: title.optional() }),
};
export const listConversationsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
};
export const getConversationSchema = {
  params,
  query: z.object({
    before: objectId.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
};
export const conversationIdSchema = { params };
export const renameConversationSchema = { params, body: z.strictObject({ title }) };
export const sendMessageSchema = {
  params,
  body: z.strictObject({ content: z.string().trim().min(1).max(2000) }),
};
