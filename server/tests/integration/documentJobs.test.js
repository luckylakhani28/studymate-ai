import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { env } from '../../src/config/env.js';
import { StudyDocument, Chunk } from '../../src/models/index.js';
import { storage } from '../../src/storage/index.js';
import { EMBEDDING_MODEL_ID } from '../../src/ai/embeddings.js';
import { JobRunner } from '../../src/jobs/JobRunner.js';
import { createDocumentQueue } from '../../src/jobs/queues/documentQueue.js';
import { shutdownOcr } from '../../src/processing/ocr/ocrService.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { makePdf, textImagePng, LOREM } from '../helpers/pdfFixtures.js';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(async () => {
  await shutdownOcr();
  await closeTestDB();
});

const makeRunner = (queue = createDocumentQueue(), overrides = {}) =>
  new JobRunner({
    workerId: 'test-worker',
    queues: [queue],
    pollIntervalMs: 10,
    lockTtlMs: 60_000,
    jobTimeoutMs: 10_000,
    maxAttempts: 3,
    ...overrides,
  });

async function seedDocument(bytes, overrides = {}) {
  const tmp = path.join(env.STORAGE_DIR, '.tmp', randomUUID());
  await mkdir(path.dirname(tmp), { recursive: true });
  await writeFile(tmp, bytes);
  const storageKey = `users/test/${randomUUID()}.pdf`;
  await storage.putFile(storageKey, tmp);
  return StudyDocument.create({
    userId: new mongoose.Types.ObjectId(),
    originalName: 'test.pdf',
    storageKey,
    mimeType: 'application/pdf',
    sizeBytes: bytes.length,
    fileHash: randomBytes(32).toString('hex'),
    ...overrides,
  });
}

const reload = (doc) => StudyDocument.findById(doc._id).lean();

describe('document processing jobs', () => {
  it('processes a text PDF to ready, with embedded chunks, and releases the lock', async () => {
    const doc = await seedDocument(await makePdf([{ text: LOREM }, { text: LOREM }]));
    expect(await makeRunner().runOnce()).toBe(true);

    const after = await reload(doc);
    expect(after.status).toBe('ready');
    expect(after.pageCount).toBe(2);
    expect(after.extraction.pageStats.map((p) => p.quality)).toEqual(['text', 'text']);
    expect(after.processing.progress).toBe(100);
    expect(after.processing.lockedBy).toBeUndefined();
    expect(after.stats.chunkCount).toBeGreaterThan(0);
    expect(
      await Chunk.countDocuments({ documentId: doc._id, generation: after.chunkGeneration }),
    ).toBe(after.stats.chunkCount);
    expect(after.embeddingModel).toBe(EMBEDDING_MODEL_ID);
    const stored = await Chunk.findOne({ documentId: doc._id }).select('embedding').lean();
    expect(stored.embedding).toHaveLength(384);
  });

  it('fails a corrupt PDF permanently without retrying', async () => {
    const doc = await seedDocument(Buffer.from('%PDF-1.7\nnot really a pdf'));
    await makeRunner().runOnce();
    const after = await reload(doc);
    expect(after.status).toBe('failed');
    expect(after.processing.attempts).toBe(1);
    expect(after.processing.lastError.code).toBe('CORRUPT_PDF');
  });

  it('retries transient errors with backoff and hides internal messages', async () => {
    const flaky = createDocumentQueue({
      process: async () => {
        throw new Error('connection reset by peer');
      },
    });
    const doc = await seedDocument(await makePdf([{ text: LOREM }]));
    const runner = makeRunner(flaky);
    await runner.runOnce();

    const after = await reload(doc);
    expect(after.status).toBe('queued');
    expect(after.processing.lastError).toMatchObject({
      code: 'PROCESSING_FAILED',
      message: 'Processing failed unexpectedly.',
    });
    expect(after.processing.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await runner.runOnce()).toBe(false); // still backing off
  });

  it('lets only one worker claim a job', async () => {
    await seedDocument(await makePdf([{ text: LOREM }]));
    const queue = createDocumentQueue();
    const claims = await Promise.all([queue.claim('w1', 60_000), queue.claim('w2', 60_000)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('reclaims a job whose worker stopped heartbeating', async () => {
    const doc = await seedDocument(await makePdf([{ text: LOREM }]), {
      status: 'processing',
      processing: {
        lockedBy: 'dead-worker',
        lockedAt: new Date(Date.now() - 120_000),
        attempts: 1,
      },
    });
    const claimed = await createDocumentQueue().claim('w2', 60_000);
    expect(String(claimed._id)).toBe(String(doc._id));
    expect(claimed.processing).toMatchObject({ lockedBy: 'w2', attempts: 2 });
  });

  it('gives up on a job that keeps getting reclaimed', async () => {
    const doc = await seedDocument(await makePdf([{ text: LOREM }]), {
      processing: { attempts: 3 },
    });
    await makeRunner().runOnce();
    const after = await reload(doc);
    expect(after.status).toBe('failed');
    expect(after.processing.lastError.code).toBe('MAX_ATTEMPTS_EXCEEDED');
  });

  it('times out a job that runs too long', async () => {
    const hanging = createDocumentQueue({
      process: (_job, { signal }) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    });
    const doc = await seedDocument(await makePdf([{ text: LOREM }]));
    await makeRunner(hanging, { jobTimeoutMs: 50 }).runOnce();
    const after = await reload(doc);
    expect(after.status).toBe('queued'); // timeouts are retryable
    expect(after.processing.lastError.code).toBe('JOB_TIMEOUT');
  });

  it('swaps chunk generations on reprocess and cleans up the old one', async () => {
    const doc = await seedDocument(await makePdf([{ text: LOREM }]));
    const runner = makeRunner();
    await runner.runOnce();
    const first = await reload(doc);

    await StudyDocument.updateOne({ _id: doc._id }, { status: 'queued', 'processing.attempts': 0 });
    await runner.runOnce();
    const second = await reload(doc);

    expect(second.chunkGeneration).not.toBe(first.chunkGeneration);
    expect(await Chunk.countDocuments({ documentId: doc._id })).toBe(second.stats.chunkCount);
  });
});

// Needs network the first time (downloads ~10 MB of English language data). SKIP_OCR_TESTS=1 to skip.
describe.skipIf(process.env.SKIP_OCR_TESTS)('OCR', () => {
  it('OCRs a scanned page and records a mixed extraction', { timeout: 120_000 }, async () => {
    const scan = textImagePng([
      'The translation lookaside buffer',
      'caches recent page table entries',
      'so most address lookups are fast.',
    ]);
    const doc = await seedDocument(await makePdf([{ text: LOREM }, { image: scan }]));
    await makeRunner().runOnce();

    const after = await reload(doc);
    expect(after.status).toBe('ready');
    expect(after.extraction).toMatchObject({ method: 'mixed', ocrPages: [2] });
    expect(after.extraction.pageStats[1]).toMatchObject({ quality: 'scanned', source: 'ocr' });
    expect(after.extraction.pageStats[1].chars).toBeGreaterThan(40);
    expect(after.extraction.avgOcrConfidence).toBeGreaterThan(60);
  });

  it('respects the OCR page cap', { timeout: 120_000 }, async () => {
    // OCR_MAX_PAGES is 1 in tests: page 2 is OCR-ed (finding nothing), page 3 is skipped.
    const doc = await seedDocument(
      await makePdf([{ text: LOREM }, { image: true }, { image: true }]),
    );
    await makeRunner().runOnce();

    const after = await reload(doc);
    expect(after.status).toBe('ready');
    expect(after.extraction).toMatchObject({ method: 'text', ocrSkippedPages: [3] });
  });
});
