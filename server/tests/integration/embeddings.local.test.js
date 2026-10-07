import { describe, it, expect } from 'vitest';
import { createEmbeddingProvider, embedDocuments, embedQuery } from '../../src/ai/embeddings.js';

const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

// Downloads the real model (~35 MB) the first time. SKIP_MODEL_TESTS=1 to skip.
describe.skipIf(process.env.SKIP_MODEL_TESTS)('local embedding model', () => {
  it('captures meaning, not just shared words', { timeout: 300_000 }, async () => {
    const local = createEmbeddingProvider('local');
    const [tlb, deadlock] = await embedDocuments(
      [
        'The TLB caches recent virtual-to-physical address translations.',
        'A deadlock needs mutual exclusion, hold and wait, and circular wait.',
      ],
      { using: local },
    );
    // No words in common with the TLB sentence: only meaning can connect them.
    const query = await embedQuery('What makes looking up memory mappings quick?', {
      using: local,
    });
    expect(tlb).toHaveLength(384);
    expect(dot(query, tlb)).toBeGreaterThan(dot(query, deadlock));
  });
});
