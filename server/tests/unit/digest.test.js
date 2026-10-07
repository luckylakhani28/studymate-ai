import { describe, it, expect } from 'vitest';
import { groupChunks, pagesFor } from '../../src/ai/digest.js';

describe('digest helpers', () => {
  it('groups consecutive chunks under a token budget', () => {
    const chunks = [100, 200, 300, 50].map((tokenCount, index) => ({ index, tokenCount }));
    expect(groupChunks(chunks, 350).map((g) => g.map((c) => c.index))).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('maps cited source ids to sorted page numbers', () => {
    const passages = [
      { pageStart: 3, pageEnd: 3 },
      { pageStart: 5, pageEnd: 6 },
    ];
    expect(pagesFor(['S2', 'S1', 'S7'], passages)).toEqual([3, 5, 6]);
  });
});
