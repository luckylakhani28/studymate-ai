import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { User } from '../../src/models/User.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const base = { name: 'Lucky', email: '  Lucky@Example.COM ', passwordHash: 'hash' };

describe('User model', () => {
  it('normalizes email and applies defaults', async () => {
    const user = await User.create(base);
    expect(user.email).toBe('lucky@example.com');
    expect(user.role).toBe('user');
    expect(user.limits.dailyTokens).toBeGreaterThan(0);
  });

  it('excludes passwordHash from queries unless explicitly selected', async () => {
    await User.create(base);
    const found = await User.findOne({ email: 'lucky@example.com' });
    expect(found.passwordHash).toBeUndefined();
    const withHash = await User.findOne({ email: 'lucky@example.com' }).select('+passwordHash');
    expect(withHash.passwordHash).toBe('hash');
  });

  it('never serializes passwordHash and exposes id instead of _id', async () => {
    const user = await User.create(base);
    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.id).toBe(user._id.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

  it('enforces unique email case-insensitively', async () => {
    await User.create(base);
    await expect(User.create({ ...base, email: 'LUCKY@example.com' })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('rejects an invalid email', async () => {
    await expect(User.create({ ...base, email: 'not-an-email' })).rejects.toThrow(/Invalid email/);
  });
});
