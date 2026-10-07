import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { StudyDocument, Chunk } from '../../src/models/index.js';
import { EMBEDDING_MODEL_ID, embedDocuments } from '../../src/ai/embeddings.js';

export const PASSAGES = [
  {
    text: 'A translation lookaside buffer caches recent page table entries so address translation is fast.',
    page: 3,
    section: 'Paging',
  },
  {
    text: 'Deadlock requires mutual exclusion, hold and wait, no preemption, and circular wait.',
    page: 7,
    section: 'Deadlocks',
  },
  {
    text: 'Round robin scheduling gives each process a fixed time quantum in turn.',
    page: 11,
    section: 'Scheduling',
  },
];

/** A processed, embedded, ready document, without running the pipeline. */
export async function seedReadyDocument(
  userId,
  passages = PASSAGES,
  { generation = 'gen-1', embeddingModel = EMBEDDING_MODEL_ID } = {},
) {
  const doc = await StudyDocument.create({
    userId,
    title: 'OS notes',
    originalName: 'os.pdf',
    storageKey: `users/test/${new mongoose.Types.ObjectId()}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 10,
    fileHash: randomBytes(32).toString('hex'),
    contentHash: randomBytes(32).toString('hex'),
    status: 'ready',
    chunkGeneration: generation,
    embeddingModel,
  });
  const vectors = await embedDocuments(passages.map((p) => p.text));
  await Chunk.insertMany(
    passages.map((p, i) => ({
      documentId: doc._id,
      userId,
      generation,
      index: i,
      text: p.text,
      tokenCount: 20,
      pageStart: p.page,
      pageEnd: p.page,
      sectionTitle: p.section,
      embedding: vectors[i],
    })),
  );
  return doc;
}
