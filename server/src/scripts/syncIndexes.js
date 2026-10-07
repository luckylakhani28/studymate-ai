// Usage: npm run db:sync-indexes -w server   (run on every deploy)
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { models } from '../models/index.js';
import { ensureVectorIndex } from '../models/searchIndexes.js';

await connectDB();
for (const model of models) {
  // Creates missing indexes and drops ones no longer in the schema: the schema is the source of truth.
  const dropped = await model.syncIndexes();
  logger.info({ model: model.modelName, dropped }, 'Indexes synced');
}
if (env.VECTOR_SEARCH_MODE === 'atlas') await ensureVectorIndex();
await disconnectDB();
