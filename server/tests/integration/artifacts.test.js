import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User, StudyArtifact } from '../../src/models/index.js';
import { provider as fakeLlm } from '../../src/ai/llm.js';
import { JobRunner } from '../../src/jobs/JobRunner.js';
import { createArtifactQueue } from '../../src/jobs/queues/artifactQueue.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { seedReadyDocument } from '../helpers/seed.js';

const app = createApp();
beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const SECTION_DIGEST = {
  summary: 'Paging, deadlocks and scheduling.',
  keyPoints: [{ point: 'The TLB caches translations', sources: ['S1'] }],
};
const SUMMARY = {
  tldr: 'Core operating-system ideas.',
  overview: 'Paging, deadlock and scheduling.',
  keyPoints: [
    'TLB speeds translation',
    'Deadlock has four conditions',
    'Round robin uses quanta',
  ].map((point) => ({
    point,
    sources: ['S1'],
  })),
};

let token;
let doc;
beforeEach(async () => {
  fakeLlm.reset();
  const user = await User.create({ name: 'A', email: 'a@example.com', passwordHash: 'x' });
  token = signAccessToken(user);
  doc = await seedReadyDocument(user._id);
});

const makeRunner = () =>
  new JobRunner({
    workerId: 'test',
    queues: [createArtifactQueue()],
    pollIntervalMs: 10,
    lockTtlMs: 60_000,
    jobTimeoutMs: 10_000,
    maxAttempts: 3,
  });
const requestArtifact = (body) =>
  request(app)
    .post(`/api/v1/documents/${doc._id}/artifacts`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('study artifacts', () => {
  it('builds a summary with map (cheap model) and reduce (smart model), citing pages', async () => {
    const res = await requestArtifact({ type: 'summary' });
    expect(res.status).toBe(202);

    fakeLlm.enqueue({ toolInput: SECTION_DIGEST }, { toolInput: SUMMARY });
    await makeRunner().runOnce();

    const artifact = await StudyArtifact.findById(res.body.data.artifact.id).lean();
    expect(artifact.status).toBe('ready');
    expect(artifact.content.keyPoints[0].pages).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(fakeLlm.calls.map((c) => c.model)).toEqual([env.AI_MODEL_FAST, env.AI_MODEL_SMART]);
  });

  it('serves repeats from cache and reuses the digest for other tools', async () => {
    const first = await requestArtifact({ type: 'summary' });
    fakeLlm.enqueue({ toolInput: SECTION_DIGEST }, { toolInput: SUMMARY });
    const runner = makeRunner();
    await runner.runOnce();

    const again = await requestArtifact({ type: 'summary' });
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({
      cached: true,
      artifact: { id: first.body.data.artifact.id },
    });

    await requestArtifact({ type: 'key_concepts' });
    // Only the reduce call is queued: if the digest weren't reused, this job would fail.
    fakeLlm.enqueue({
      toolInput: {
        concepts: [{ term: 'TLB', definition: 'A cache of translations', sources: ['S1'] }],
      },
    });
    await runner.runOnce();

    expect(fakeLlm.calls).toHaveLength(3);
    expect((await StudyArtifact.findOne({ type: 'key_concepts' }).lean()).status).toBe('ready');
  });

  it('validates options and creates a fresh quiz on regenerate', async () => {
    expect((await requestArtifact({ type: 'quiz', options: { count: 100 } })).status).toBe(400);
    const a = await requestArtifact({ type: 'quiz', options: { count: 3 }, regenerate: true });
    const b = await requestArtifact({ type: 'quiz', options: { count: 3 }, regenerate: true });
    expect(a.status).toBe(202);
    expect(b.body.data.artifact.id).not.toBe(a.body.data.artifact.id);
  });
});
