import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const make = (overrides = {}) =>
  RefreshToken.create({
    userId: new mongoose.Types.ObjectId(),
    tokenHash: 'a'.repeat(64),
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

describe('RefreshToken model', () => {
  it('has a TTL index on expiresAt', async () => {
    const indexes = await RefreshToken.collection.indexes();
    const ttl = indexes.find((i) => i.key.expiresAt === 1);
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it('enforces unique tokenHash', async () => {
    await make();
    await expect(make()).rejects.toMatchObject({ code: 11000 });
  });

  it('isActive reflects revocation and expiry', async () => {
    expect((await make()).isActive()).toBe(true);
    const revoked = await make({ tokenHash: 'b'.repeat(64), revokedAt: new Date() });
    expect(revoked.isActive()).toBe(false);
    const expired = await make({
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(expired.isActive()).toBe(false);
  });

  it('truncates oversized user agents instead of rejecting', async () => {
    const token = await make({ userAgent: 'x'.repeat(1000) });
    expect(token.userAgent).toHaveLength(512);
  });
});
