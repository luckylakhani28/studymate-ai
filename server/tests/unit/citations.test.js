import { describe, it, expect } from 'vitest';
import { extractCitations, stripCitations } from '../../src/ai/citations.js';

const source = (page) => ({
  chunkId: 'c',
  documentId: 'd',
  documentTitle: 'OS',
  pageStart: page,
  pageEnd: page,
});

describe('citations', () => {
  it('collects cited sources in order of first appearance and drops invented ids', () => {
    const cites = extractCitations('First [S2]. Then [S1, S2]. Bogus [S9].', [
      source(1),
      source(2),
      source(3),
    ]);
    expect(cites.map((c) => c.label)).toEqual(['S2', 'S1']);
    expect(cites[0]).toMatchObject({ pageStart: 2 });
  });

  it('strips markers from text reused as conversation history', () => {
    expect(stripCitations('Paging helps [S1]. Really [S1, S3].')).toBe('Paging helps. Really.');
  });
});
