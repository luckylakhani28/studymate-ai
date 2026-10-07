import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import { requireQuota } from '../middleware/requireQuota.js';
import * as chat from '../controllers/chat.controller.js';
import * as v from '../validators/chat.validators.js';

export const conversationsRouter = Router();

conversationsRouter.use(authenticate);
conversationsRouter.post('/', validate(v.createConversationSchema), chat.create);
conversationsRouter.get('/', validate(v.listConversationsSchema), chat.list);
conversationsRouter.get('/:id', validate(v.getConversationSchema), chat.get);
conversationsRouter.patch('/:id', validate(v.renameConversationSchema), chat.rename);
conversationsRouter.delete('/:id', validate(v.conversationIdSchema), chat.remove);
conversationsRouter.post(
  '/:id/messages',
  aiLimiter,
  validate(v.sendMessageSchema),
  requireQuota,
  chat.sendMessage,
);
