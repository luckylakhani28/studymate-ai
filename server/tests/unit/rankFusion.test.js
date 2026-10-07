import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from '../../src/ai/rankFusion.js';

describe('reciprocalRankFusion', () => {
  it('rewards items found by both retrievers', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['c', 'd'],
    ]);
    expect(fused[0].id).toBe('c');
  });

  it('keeps single-list order when the other list is empty', () => {
    expect(reciprocalRankFusion([['x', 'y', 'z'], []]).map((f) => f.id)).toEqual(['x', 'y', 'z']);
  });
});
