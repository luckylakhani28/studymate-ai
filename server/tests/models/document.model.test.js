import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { StudyDocument } from '../../src/models/Document.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const userA = new mongoose.Types.ObjectId();
const userB = new mongoose.Types.ObjectId();

const makeDoc = (overrides = {}) =>
  StudyDocument.create({
    userId: userA,
    originalName: 'OS Notes.pdf',
    storageKey: 'users/a/abc123',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    fileHash: 'f'.repeat(64),
    ...overrides,
  });

describe('Document model', () => {
  it('applies defaults and derives title from the filename', async () => {
    const doc = await makeDoc();
    expect(doc.title).toBe('OS Notes');
    expect(doc.status).toBe('queued');
    expect(doc.processing.progress).toBe(0);
    expect(doc.processing.attempts).toBe(0);
    expect(doc.tags).toHaveLength(0);
  });

  it('dedupes per user, not globally', async () => {
    await makeDoc();
    await expect(makeDoc()).rejects.toMatchObject({ code: 11000 });
    await expect(makeDoc({ userId: userB })).resolves.toBeTruthy();
  });

  it('findOwned never returns another user’s document', async () => {
    const doc = await makeDoc();
    expect(await StudyDocument.findOwned(doc._id, userA)).not.toBeNull();
    expect(await StudyDocument.findOwned(doc._id, userB)).toBeNull();
  });

  it('validates status, hash format, and tag count', async () => {
    await expect(makeDoc({ status: 'done' })).rejects.toThrow(/status/);
    await expect(makeDoc({ fileHash: 'xyz' })).rejects.toThrow(/fileHash/);
    const tooMany = Array.from({ length: 11 }, (_, i) => `t${i}`);
    await expect(makeDoc({ tags: tooMany })).rejects.toThrow(/At most 10 tags/);
  });

  it('hides storage and lock internals from JSON', async () => {
    const doc = await makeDoc({ processing: { lockedBy: 'worker-1', lockedAt: new Date() } });
    const json = doc.toJSON();
    expect(json.storageKey).toBeUndefined();
    expect(json.processing.lockedBy).toBeUndefined();
    expect(json.processing.lockedAt).toBeUndefined();
    expect(json.processing.progress).toBe(0);
  });
});
