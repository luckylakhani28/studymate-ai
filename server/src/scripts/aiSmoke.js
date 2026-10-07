// Usage: npm run ai:smoke -w server -- <documentId>
// Summarizes the first three passages of a ready document with the real model.
import { connectDB, disconnectDB } from '../config/db.js';
import { StudyDocument, Chunk } from '../models/index.js';
import { llm } from '../ai/llm.js';

const [documentId] = process.argv.slice(2);
if (!documentId) {
  console.error('Usage: npm run ai:smoke -w server -- <documentId>');
  process.exit(1);
}

await connectDB();
try {
  const doc = await StudyDocument.findById(documentId).lean();
  if (doc?.status !== 'ready') throw new Error('Document not found or not ready');
  const passages = await Chunk.find({ documentId: doc._id, generation: doc.chunkGeneration })
    .sort({ index: 1 })
    .limit(3)
    .lean();

  const started = Date.now();
  const { data, usage, attempts } = await llm.runPrompt(
    'section_summary',
    { documentTitle: doc.title, passages },
    { userId: doc.userId, feature: 'smoke_test' },
  );

  console.log(JSON.stringify(data, null, 2));
  console.log(
    `\n${usage.calls} call(s), ${attempts} attempt(s), ${usage.inputTokens} in / ${usage.outputTokens} out tokens, ` +
      `$${usage.costUsd.toFixed(5)}, ${Date.now() - started} ms`,
  );
} finally {
  await disconnectDB();
}
