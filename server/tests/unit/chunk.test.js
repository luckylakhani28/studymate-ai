import { describe, it, expect } from 'vitest';
import { CHUNK_DEFAULTS, chunkBlocks } from '../../src/processing/text/chunk.js';

// Each sentence is ~19 tokens.
const sentence = (i) =>
  `Sentence number ${i} explains one idea about operating systems in plain words.`;
const textBlock = (page, from, count) => ({
  type: 'text',
  page,
  text: Array.from({ length: count }, (_, k) => sentence(from + k)).join(' '),
});

describe('chunkBlocks', () => {
  const longDoc = [textBlock(1, 0, 40), textBlock(2, 40, 40)];

  it('keeps chunks near the target size and records page ranges', () => {
    const chunks = chunkBlocks(longDoc);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    for (const c of chunks)
      expect(c.tokenCount).toBeLessThanOrEqual(CHUNK_DEFAULTS.targetTokens * 1.1);
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks.at(-1).pageEnd).toBe(2);
    expect(chunks.some((c) => c.pageStart === 1 && c.pageEnd === 2)).toBe(true);
  });

  it('overlaps consecutive chunks so boundary ideas survive', () => {
    const chunks = chunkBlocks(longDoc);
    const lastSentence = chunks[0].text.split(/(?<=\.)\s+/).at(-1);
    expect(chunks[1].text).toContain(lastSentence);
  });

  it('starts a new chunk at each heading and tags the section', () => {
    const chunks = chunkBlocks([
      { type: 'heading', text: '1 Paging', page: 1 },
      textBlock(1, 0, 10),
      { type: 'heading', text: '2 Segmentation', page: 2 },
      textBlock(2, 10, 10),
    ]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ sectionTitle: '1 Paging', pageStart: 1 });
    expect(chunks[0].text.startsWith('1 Paging')).toBe(true);
    expect(chunks[1]).toMatchObject({ sectionTitle: '2 Segmentation', pageStart: 2 });
  });

  it('force-splits a single oversized sentence', () => {
    const chunks = chunkBlocks([{ type: 'text', page: 1, text: 'word '.repeat(1000).trim() }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(CHUNK_DEFAULTS.maxTokens + 1);
  });
});
