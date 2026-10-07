import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StudyDocument, Chunk, Message, StudyArtifact, AiUsage } from '../../src/models/index.js';
import { connectTestDB, closeTestDB } from '../helpers/db.js';

beforeAll(connectTestDB);
afterAll(closeTestDB);

const { ObjectId } = mongoose.Types;
const userId = new ObjectId();
const id = new ObjectId();
const now = new Date();

// The hot paths: if a schema change drops an index, the query silently becomes a collection scan.
const QUERIES = [
  ['library listing', () => StudyDocument.find({ userId }).sort({ createdAt: -1 }).limit(20)],
  [
    'active chunks of a document',
    () => Chunk.find({ documentId: id, generation: 'g' }).sort({ index: 1 }),
  ],
  [
    'a page of chat messages',
    () => Message.find({ conversationId: id }).sort({ _id: -1 }).limit(51),
  ],
  ['the artifact cache lookup', () => StudyArtifact.findOne({ userId, cacheKey: 'k' })],
  ['the 24h quota window', () => AiUsage.find({ userId, createdAt: { $gte: new Date(0) } })],
  [
    'claiming the next job',
    () =>
      StudyDocument.find({
        $or: [
          {
            status: 'queued',
            $or: [{ 'processing.availableAt': null }, { 'processing.availableAt': { $lte: now } }],
          },
          { status: 'processing', 'processing.lockedAt': { $lt: now } },
        ],
      })
        .sort({ createdAt: 1 })
        .limit(1),
  ],
];

describe('hot queries use indexes', () => {
  it.each(QUERIES)('%s', async (_name, build) => {
    const explain = await build().explain('queryPlanner');
    const plan = JSON.stringify(explain.queryPlanner.winningPlan);
    expect(plan).toContain('IXSCAN');
    expect(plan).not.toContain('COLLSCAN');
  });
});
