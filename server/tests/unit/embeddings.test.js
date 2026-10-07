import { describe, it, expect } from 'vitest';
import { EMBEDDING_DIMENSIONS, embedDocuments } from '../../src/ai/embeddings.js';

const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

describe('embedDocuments (hash provider in tests)', () => {
  it('returns normalized vectors where shared words mean higher similarity', async () => {
    const [a, b, c] = await embedDocuments([
      'paging uses page tables',
      'page tables map pages',
      'deadlock needs circular wait',
    ]);
    expect(a).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(dot(a, a)).toBeCloseTo(1, 5);
    expect(dot(a, b)).toBeGreaterThan(dot(a, c));
  });
});
