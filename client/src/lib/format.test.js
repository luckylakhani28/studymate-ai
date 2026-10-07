import { describe, it, expect } from 'vitest';
import { formatPages, pageRange } from './format.js';

describe('page formatting', () => {
  it('collapses consecutive pages into ranges', () => {
    expect(formatPages([3, 4, 5, 9])).toBe('pp. 3–5, 9');
    expect(formatPages([7])).toBe('p. 7');
    expect(formatPages([])).toBe('');
    expect(pageRange(2, 2)).toBe('p. 2');
  });
});
