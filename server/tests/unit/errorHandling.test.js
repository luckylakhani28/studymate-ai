import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, it, expect } from 'vitest';
import { validate } from '../../src/middleware/validate.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { AppError } from '../../src/utils/AppError.js';
import { ok } from '../../src/utils/apiResponse.js';

const app = express();
app.use(express.json());
app.post(
  '/items/:id',
  validate({
    params: z.object({ id: z.string().length(24) }),
    body: z.object({ name: z.string().min(1) }).strict(),
  }),
  (req, res) => ok(res, req.validated),
);
app.get('/async-conflict', async () => {
  throw new AppError('CONFLICT', { message: 'Already exists' });
});
app.get('/crash', () => {
  throw new Error('db password is hunter2');
});
app.use(errorHandler);

const validId = 'a'.repeat(24);

describe('validate + errorHandler', () => {
  it('passes valid input through on req.validated', async () => {
    const res = await request(app).post(`/items/${validId}`).send({ name: 'Notes' });
    expect(res.status).toBe(200);
    expect(res.body.data.body).toEqual({ name: 'Notes' });
  });

  it('reports field-level details across params and body', async () => {
    const res = await request(app).post('/items/short').send({ name: '' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['params.id', 'body.name']));
  });

  it('strict schemas reject NoSQL operator injection', async () => {
    const res = await request(app).post(`/items/${validId}`).send({ name: 'x', $where: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('catches errors thrown from async handlers (Express 5)', async () => {
    const res = await request(app).get('/async-conflict');
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Already exists');
  });

  it('never leaks internal error messages', async () => {
    const res = await request(app).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });
});
