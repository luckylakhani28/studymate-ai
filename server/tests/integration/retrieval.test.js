import mongoose from 'mongoose';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { User, Chunk } from '../../src/models/index.js';
import { embedDocuments } from '../../src/ai/embeddings.js';
import { retrieveChunks } from '../../src/ai/retrieval.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { PASSAGES, seedReadyDocument } from '../helpers/seed.js';

const { ObjectId } = mongoose.Types;
const app = createApp();
beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('retrieveChunks', () => {
  it('ranks the relevant passage first and returns its pages', async () => {
    const userId = new ObjectId();
    await seedReadyDocument(userId);
    const { results } = await retrieveChunks({
      userId,
      query: 'why is the translation lookaside buffer fast',
      limit: 3,
    });
    expect(results[0]).toMatchObject({ pageStart: 3, sectionTitle: 'Paging' });
    expect(results[0].vectorScore).toBeGreaterThan(0.5);
  });

  it('only searches the caller’s active chunks from current-model documents', async () => {
    const alice = new ObjectId();
    await seedReadyDocument(new ObjectId()); // another user's notes
    const stale = await seedReadyDocument(alice, PASSAGES, { embeddingModel: 'old-model' });
    const current = await seedReadyDocument(alice, [PASSAGES[1]], { generation: 'gen-2' });
    const [leftover] = await embedDocuments([PASSAGES[0].text]);
    await Chunk.create({
      documentId: current._id,
      userId: alice,
      generation: 'gen-old',
      index: 0,
      text: PASSAGES[0].text,
      tokenCount: 20,
      pageStart: 99,
      pageEnd: 99,
      embedding: leftover,
    });

    const { results, staleDocumentIds } = await retrieveChunks({
      userId: alice,
      query: 'translation lookaside buffer',
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.documentId === String(current._id))).toBe(true);
    expect(results.some((r) => r.pageStart === 99)).toBe(false);
    expect(staleDocumentIds).toEqual([String(stale._id)]);
  });

  it('treats search operators in the question as plain words', async () => {
    const userId = new ObjectId();
    await seedReadyDocument(userId);
    const { results } = await retrieveChunks({
      userId,
      query: '"round robin" -scheduling',
      mode: 'keyword',
    });
    expect(results[0].pageStart).toBe(11);
  });

  it('exposes search to authenticated users only', async () => {
    const user = await User.create({ name: 'A', email: 'a@example.com', passwordHash: 'x' });
    await seedReadyDocument(user._id);
    expect((await request(app).post('/api/v1/search').send({ query: 'deadlock' })).status).toBe(
      401,
    );

    const res = await request(app)
      .post('/api/v1/search')
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .send({ query: 'conditions for deadlock' });
    expect(res.status).toBe(200);
    expect(res.body.data.results[0].pageStart).toBe(7);
  });
});
