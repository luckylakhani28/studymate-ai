import { existsSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User, StudyDocument, Chunk } from '../../src/models/index.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';

const app = createApp();
beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const pdf = (text = 'lecture notes') => Buffer.from(`%PDF-1.7\n% ${text}\n%%EOF\n`);
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const tokenFor = async (email) =>
  signAccessToken(await User.create({ name: 'Test', email, passwordHash: 'x' }));

let alice;
let bob;
beforeEach(async () => {
  alice = await tokenFor('alice@example.com');
  bob = await tokenFor('bob@example.com');
});

const upload = (
  token,
  { body = pdf(), filename = 'Lecture 1.pdf', contentType = 'application/pdf' } = {},
) =>
  request(app)
    .post('/api/v1/documents')
    .set(auth(token))
    .attach('file', body, { filename, contentType });
const uploadOk = async (token, text) =>
  (await upload(token, { body: pdf(text) })).body.data.document;

describe('POST /documents', () => {
  it('accepts a PDF and queues it for processing', async () => {
    const res = await upload(alice);
    expect(res.status).toBe(202);
    expect(res.body.data.document).toMatchObject({
      title: 'Lecture 1',
      originalName: 'Lecture 1.pdf',
      status: 'queued',
    });
    expect(res.body.data.document.storageKey).toBeUndefined();
  });

  it('rejects files that are not really PDFs, whatever their name says', async () => {
    const res = await upload(alice, { body: Buffer.from('MZ this is an executable') });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  it('rejects non-PDF names and MIME types up front', async () => {
    const res = await upload(alice, { filename: 'notes.docx', contentType: 'application/msword' });
    expect(res.status).toBe(415);
  });

  it('requires a file', async () => {
    const res = await request(app).post('/api/v1/documents').set(auth(alice));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('file');
  });

  it('enforces the size limit', async () => {
    const body = Buffer.concat([pdf(), Buffer.alloc(env.MAX_UPLOAD_MB * 1024 * 1024 + 1)]);
    const res = await upload(alice, { body });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('detects duplicates per user and points to the existing document', async () => {
    const first = await uploadOk(alice);
    const again = await upload(alice);
    expect(again.status).toBe(409);
    expect(again.body.error.details.documentId).toBe(first.id);
    expect((await upload(bob)).status).toBe(202); // same bytes, different user: allowed
  });

  it('rejects unauthenticated uploads', async () => {
    const res = await request(app).post('/api/v1/documents').attach('file', pdf(), 'a.pdf');
    expect(res.status).toBe(401);
  });
});

describe('reading documents', () => {
  it('lists only the caller’s documents, with pagination meta', async () => {
    await uploadOk(alice, 'one');
    await uploadOk(alice, 'two');
    await uploadOk(bob, 'three');
    const res = await request(app).get('/api/v1/documents?limit=1').set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it('hides other users’ documents behind a 404', async () => {
    const doc = await uploadOk(alice);
    for (const suffix of ['', '/file', '/status']) {
      const res = await request(app).get(`/api/v1/documents/${doc.id}${suffix}`).set(auth(bob));
      expect(res.status).toBe(404);
    }
  });

  it('streams the original bytes back, sandboxed', async () => {
    const doc = await uploadOk(alice, 'exact bytes');
    const res = await request(app)
      .get(`/api/v1/documents/${doc.id}/file`)
      .set(auth(alice))
      .responseType('blob');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.body.equals(pdf('exact bytes'))).toBe(true);
  });

  it('lists only the active chunk generation of a ready document', async () => {
    const doc = await uploadOk(alice);
    const notReady = await request(app).get(`/api/v1/documents/${doc.id}/chunks`).set(auth(alice));
    expect(notReady.status).toBe(409);

    const { userId } = await StudyDocument.findById(doc.id);
    const chunk = (generation, index) => ({
      documentId: doc.id,
      userId,
      generation,
      index,
      text: `${generation}-${index}`,
      tokenCount: 1,
      pageStart: 1,
      pageEnd: 1,
    });
    await Chunk.insertMany([chunk('old', 0), chunk('new', 0), chunk('new', 1)]);
    await StudyDocument.updateOne({ _id: doc.id }, { status: 'ready', chunkGeneration: 'new' });

    const res = await request(app).get(`/api/v1/documents/${doc.id}/chunks`).set(auth(alice));
    expect(res.body.data.chunks.map((c) => c.text)).toEqual(['new-0', 'new-1']);
    expect(res.body.meta.total).toBe(2);
  });
});

describe('changing documents', () => {
  it('renames and tags, and rejects empty updates', async () => {
    const doc = await uploadOk(alice);
    const res = await request(app)
      .patch(`/api/v1/documents/${doc.id}`)
      .set(auth(alice))
      .send({ title: 'OS Midterm', tags: ['OS', 'os', 'exam'] });
    expect(res.body.data.document).toMatchObject({ title: 'OS Midterm', tags: ['os', 'exam'] });

    const empty = await request(app).patch(`/api/v1/documents/${doc.id}`).set(auth(alice)).send({});
    expect(empty.status).toBe(400);
  });

  it('deletes the record, its chunks, and the stored file', async () => {
    const doc = await uploadOk(alice);
    const { storageKey, userId } = await StudyDocument.findById(doc.id);
    await Chunk.create({
      documentId: doc.id,
      userId,
      generation: 'g1',
      index: 0,
      text: 'x',
      tokenCount: 1,
      pageStart: 1,
      pageEnd: 1,
    });
    const filePath = path.join(env.STORAGE_DIR, storageKey);
    expect(existsSync(filePath)).toBe(true);

    const res = await request(app).delete(`/api/v1/documents/${doc.id}`).set(auth(alice));
    expect(res.status).toBe(204);
    expect(existsSync(filePath)).toBe(false);
    expect(await Chunk.countDocuments({ documentId: doc.id })).toBe(0);
    expect((await request(app).get(`/api/v1/documents/${doc.id}`).set(auth(alice))).status).toBe(
      404,
    );
  });

  it('requeues a failed document for processing', async () => {
    const doc = await uploadOk(alice);
    await StudyDocument.updateOne(
      { _id: doc.id },
      {
        status: 'failed',
        'processing.attempts': 3,
        'processing.lastError': { code: 'CORRUPT_PDF', message: 'x' },
      },
    );
    const res = await request(app).post(`/api/v1/documents/${doc.id}/reprocess`).set(auth(alice));
    expect(res.status).toBe(202);
    expect(res.body.data.document.status).toBe('queued');
    expect(res.body.data.document.processing.attempts).toBe(0);
  });

  it('refuses to reprocess a document that is already queued', async () => {
    const doc = await uploadOk(alice);
    const res = await request(app).post(`/api/v1/documents/${doc.id}/reprocess`).set(auth(alice));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_PROCESSING');
  });
});
