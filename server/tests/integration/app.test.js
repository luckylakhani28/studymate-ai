import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('app foundation', () => {
  it('health returns a 503 envelope when the DB is not connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: { code: 'SERVICE_UNAVAILABLE' } });
    expect(res.body.requestId).toBeTruthy();
  });

  it('unknown routes return a 404 envelope', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('echoes a valid incoming X-Request-Id', async () => {
    const res = await request(app).get('/api/v1/nope').set('X-Request-Id', 'trace-12345678');
    expect(res.headers['x-request-id']).toBe('trace-12345678');
    expect(res.body.requestId).toBe('trace-12345678');
  });

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
