import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User, AiUsage } from '../../src/models/index.js';
import { createLlm } from '../../src/ai/llm.js';
import { createFakeProvider } from '../../src/ai/providers/fake.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';

const app = createApp();
beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const input = {
  documentTitle: 'OS notes',
  passages: [
    {
      text: 'The TLB caches recent address translations.',
      pageStart: 3,
      pageEnd: 3,
      sectionTitle: 'Paging',
    },
    { text: 'Deadlock needs four conditions.', pageStart: 7, pageEnd: 7 },
  ],
};
const valid = {
  summary: 'Paging relies on the TLB for speed.',
  keyPoints: [{ point: 'The TLB caches translations', sources: ['S1'] }],
};

let fake;
let llm;
let user;
beforeEach(async () => {
  fake = createFakeProvider();
  llm = createLlm({ provider: fake });
  user = await User.create({ name: 'A', email: 'a@example.com', passwordHash: 'x' });
});
const run = () => llm.runPrompt('section_summary', input, { userId: user._id });

describe('llm.runPrompt', () => {
  it('forces structured output and meters the call', async () => {
    fake.enqueue({ toolInput: valid });
    const { data, attempts } = await run();

    expect(data).toEqual(valid);
    expect(attempts).toBe(1);
    expect(fake.calls[0]).toMatchObject({
      model: env.AI_MODEL_FAST,
      tool_choice: { type: 'tool', name: 'submit_result' },
    });
    expect(fake.calls[0].tools[0].input_schema.type).toBe('object');

    const [row] = await AiUsage.find({ userId: user._id }).lean();
    expect(row).toMatchObject({
      feature: 'section_summary',
      promptVersion: 1,
      inputTokens: 100,
      outputTokens: 50,
      quotaTokens: 150,
      status: 'ok',
    });
    expect(row.costUsd).toBeCloseTo(0.00035, 8); // 100 × $1/M + 50 × $5/M
  });

  it('repairs output that cites a source that doesn’t exist', async () => {
    fake.enqueue(
      { toolInput: { ...valid, keyPoints: [{ point: 'Made up', sources: ['S9'] }] } },
      { toolInput: valid },
    );
    const { data, attempts } = await run();

    expect(data).toEqual(valid);
    expect(attempts).toBe(2);
    const feedback = fake.calls[1].messages.at(-1).content[0];
    expect(feedback).toMatchObject({ type: 'tool_result', is_error: true });
    expect(feedback.content).toContain('S9');
    expect(await AiUsage.countDocuments({ userId: user._id })).toBe(2); // both attempts metered
  });

  it('gives up after one failed repair', async () => {
    fake.enqueue({ toolInput: { keyPoints: [] } }, { toolInput: { keyPoints: [] } });
    await expect(run()).rejects.toMatchObject({ code: 'AI_OUTPUT_INVALID' });
  });

  it('refuses to start a call that would exceed the quota', async () => {
    await User.updateOne({ _id: user._id }, { 'limits.dailyTokens': 1000 });
    await AiUsage.create({ userId: user._id, feature: 'qa', status: 'ok', quotaTokens: 950 });
    await expect(run()).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    expect(fake.calls).toHaveLength(0); // nothing was spent
  });

  it('maps provider outages to a retryable error and still records the attempt', async () => {
    fake.enqueue(Object.assign(new Error('Overloaded'), { status: 529 }));
    await expect(run()).rejects.toMatchObject({ code: 'LLM_UNAVAILABLE', retryable: true });
    const [row] = await AiUsage.find({ userId: user._id }).lean();
    expect(row).toMatchObject({ status: 'error', errorCode: 'LLM_UNAVAILABLE' });
  });

  it('reports truncated output instead of parsing half a JSON object', async () => {
    fake.enqueue({ toolInput: { summary: 'Paging rel' }, stopReason: 'max_tokens' });
    await expect(run()).rejects.toMatchObject({ code: 'AI_OUTPUT_TRUNCATED' });
  });
});

describe('GET /usage/me', () => {
  it('reports rolling 24h usage against the limit', async () => {
    await AiUsage.collection.insertMany([
      {
        userId: user._id,
        feature: 'section_summary',
        status: 'ok',
        quotaTokens: 300,
        createdAt: new Date(),
      },
      {
        userId: user._id,
        feature: 'qa',
        status: 'ok',
        quotaTokens: 5000,
        createdAt: new Date(Date.now() - 30 * 3600 * 1000),
      },
    ]);
    const res = await request(app)
      .get('/api/v1/usage/me')
      .set('Authorization', `Bearer ${signAccessToken(user)}`);

    const limit = user.limits.dailyTokens;
    expect(res.body.data).toMatchObject({ used: 300, limit, remaining: limit - 300 });
    expect(res.body.data.byFeature).toEqual([
      { feature: 'section_summary', tokens: 300, calls: 1 },
    ]);
  });
});
