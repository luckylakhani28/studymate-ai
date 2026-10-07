import { randomUUID } from 'node:crypto';
import { StudyDocument, Chunk } from '../../models/index.js';
import { processDocument } from '../handlers/processDocument.js';
import { createMongoQueue } from './mongoQueue.js';

export function createDocumentQueue({ process = processDocument } = {}) {
  const base = createMongoQueue({
    name: 'documents',
    Model: StudyDocument,
    process,
    initialStage: 'extracting',
  });

  return {
    ...base,
    /**
     * 1. Insert the new chunks under a fresh generation id (old chunks untouched).
     * 2. Flip the document to that generation, only if we still hold the lock.
     * 3. Delete the losing generation: the old one if we won, our own if we lost the lock.
     */
    async complete(job, workerId, { chunks = [], ...result }) {
      const generation = randomUUID();
      if (chunks.length) {
        await Chunk.insertMany(
          chunks.map((c) => ({ ...c, documentId: job._id, userId: job.userId, generation })),
        );
      }
      const swapped = await base.markReady(job, workerId, {
        pageCount: result.pageCount,
        extraction: result.extraction,
        stats: result.stats,
        metadata: result.metadata,
        contentHash: result.contentHash,
        embeddingModel: result.embeddingModel,
        chunkGeneration: generation,
      });
      await Chunk.deleteMany(
        swapped
          ? { documentId: job._id, generation: { $ne: generation } }
          : { documentId: job._id, generation },
      );
    },
  };
}
