import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { RefreshToken } from '../../src/models/index.js';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';

const app = createApp();
beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const creds = { name: 'Lucky', email: 'lucky@example.com', password: 'secret123' };

const refreshCookieOf = (res) =>
  res.headers['set-cookie']?.find((c) => c.startsWith('sm_rt='))?.split(';')[0];

const register = (body = creds) => request(app).post('/api/v1/auth/register').send(body);
const login = (body) => request(app).post('/api/v1/auth/login').send(body);
const refreshWith = (cookie) => request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
const me = (token) => request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

describe('POST /auth/register', () => {
  it('creates a user, returns an access token, and sets a hardened refresh cookie', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ name: 'Lucky', email: 'lucky@example.com' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await register();
    const res = await register({ ...creds, email: 'LUCKY@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('enforces the password policy', async () => {
    const res = await register({ ...creds, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('body.password');
  });
});

describe('POST /auth/login', () => {
  it('returns an identical error for wrong password and unknown email', async () => {
    await register();
    const wrongPassword = await login({ email: creds.email, password: 'wrong1234' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: 'wrong1234' });
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('logs in, and the access token works on /me', async () => {
    await register();
    const res = await login({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    const meRes = await me(res.body.data.accessToken);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(creds.email);
  });
});

describe('GET /auth/me', () => {
  it('distinguishes missing, invalid, and expired tokens', async () => {
    const missing = await request(app).get('/api/v1/auth/me');
    expect(missing.body.error.code).toBe('UNAUTHORIZED');

    expect((await me('not.a.jwt')).body.error.code).toBe('INVALID_TOKEN');

    const expired = jwt.sign(
      { role: 'user', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_ACCESS_SECRET,
      {
        subject: '507f1f77bcf86cd799439011',
        issuer: 'studymate-api',
        audience: 'studymate-client',
      },
    );
    expect((await me(expired)).body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('accepts tokens signed with the previous secret during a rotation, and nothing else', async () => {
    const { body } = await register();
    const options = {
      subject: body.data.user.id,
      issuer: 'studymate-api',
      audience: 'studymate-client',
      expiresIn: '5m',
    };
    const oldToken = jwt.sign({ role: 'user' }, process.env.JWT_ACCESS_SECRET_PREVIOUS, options);
    expect((await me(oldToken)).status).toBe(200);
    const forged = jwt.sign(
      { role: 'user' },
      'an-attacker-secret-that-is-long-enough-123',
      options,
    );
    expect((await me(forged)).body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a working access token', async () => {
    const cookie = refreshCookieOf(await register());
    const res = await refreshWith(cookie);
    expect(res.status).toBe(200);
    const next = refreshCookieOf(res);
    expect(next).toBeTruthy();
    expect(next).not.toBe(cookie);
    expect((await me(res.body.data.accessToken)).status).toBe(200);
  });

  it('tolerates a near-simultaneous reuse (multi-tab race) without killing the session', async () => {
    const cookie = refreshCookieOf(await register());
    const next = refreshCookieOf(await refreshWith(cookie));
    const raced = await refreshWith(cookie);
    expect(raced.status).toBe(409);
    expect(raced.body.error.code).toBe('REFRESH_RACE');
    expect(raced.headers['set-cookie']).toBeUndefined(); // the winner's cookie survives
    expect((await refreshWith(next)).status).toBe(200);
  });

  it('detects replay of a rotated token and revokes the whole family', async () => {
    const cookie = refreshCookieOf(await register());
    const next = refreshCookieOf(await refreshWith(cookie));
    // Simulate an attacker replaying the old token well after the grace window.
    await RefreshToken.updateMany(
      { replacedByHash: { $ne: null } },
      { $set: { revokedAt: new Date(Date.now() - 60_000) } },
    );
    const replay = await refreshWith(cookie);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    expect((await refreshWith(next)).status).toBe(401); // the legitimate token died too
  });

  it('rejects a request with no cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const cookie = refreshCookieOf(await register());
    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/sm_rt=;/);
    expect((await refreshWith(cookie)).status).toBe(401);
  });

  it('logs out every session for the user', async () => {
    const first = await register();
    const second = await login({ email: creds.email, password: creds.password });
    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${second.body.data.accessToken}`);
    expect(res.status).toBe(204);
    for (const session of [first, second]) {
      expect((await refreshWith(refreshCookieOf(session))).status).toBe(401);
    }
  });
});
