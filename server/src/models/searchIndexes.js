import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { EMBEDDING_DIMENSIONS } from '../ai/embeddings.js';
import { Chunk } from './Chunk.js';

export const VECTOR_INDEX_DEFINITION = {
  fields: [
    {
      type: 'vector',
      path: 'embedding',
      numDimensions: EMBEDDING_DIMENSIONS,
      similarity: 'cosine',
    },
    { type: 'filter', path: 'userId' }, // pre-filter: other users' chunks are never even candidates
    { type: 'filter', path: 'generation' }, // only the active chunk set of each document
  ],
};

const sameFields = (a = [], b = []) => {
  const key = (fields) => JSON.stringify([...fields].sort((x, y) => x.path.localeCompare(y.path)));
  return key(a) === key(b);
};

/** Creates or updates the Atlas Vector Search index, then waits until it can be queried. */
export async function ensureVectorIndex({ waitMs = 180_000 } = {}) {
  const name = env.VECTOR_INDEX_NAME;
  const collection = Chunk.collection;
  const [existing] = await collection.listSearchIndexes(name).toArray();

  if (!existing) {
    await collection.createSearchIndex({
      name,
      type: 'vectorSearch',
      definition: VECTOR_INDEX_DEFINITION,
    });
    logger.info({ name }, 'Vector index created; building…');
  } else if (!sameFields(existing.latestDefinition?.fields, VECTOR_INDEX_DEFINITION.fields)) {
    await collection.updateSearchIndex(name, VECTOR_INDEX_DEFINITION); // triggers a rebuild, so only when changed
    logger.info({ name }, 'Vector index definition changed; rebuilding…');
  }

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const [index] = await collection.listSearchIndexes(name).toArray();
    if (index?.queryable) {
      logger.info({ name }, 'Vector index is queryable');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  logger.warn({ name }, 'Vector index is still building; it will become queryable shortly');
}
