import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { documentsRouter } from './documents.routes.js';
import { searchRouter } from './search.routes.js';
import { usageRouter } from './usage.routes.js';
import { artifactsRouter } from './artifacts.routes.js';
import { conversationsRouter } from './conversations.routes.js';

export const apiV1Router = Router();

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/documents', documentsRouter);
apiV1Router.use('/search', searchRouter);
apiV1Router.use('/usage', usageRouter);
apiV1Router.use('/artifacts', artifactsRouter);
apiV1Router.use('/conversations', conversationsRouter);
