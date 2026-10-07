import { describe, it, expect } from 'vitest';
import { buildBlocks, isHeading, normalizeUnicode } from '../../src/processing/text/normalize.js';

const pages = (...texts) => texts.map((text, i) => ({ pageNumber: i + 1, text }));

describe('text normalization', () => {
  it('fixes ligatures and invisible characters but keeps math symbols', () => {
    expect(normalizeUnicode('\uFB01le\u00A0system\u200B uses x² and soft\u00ADhyphens')).toBe(
      'file system uses x² and softhyphens',
    );
  });

  it('strips repeated headers, footers, and page numbers', () => {
    const bodies = [
      'Paging divides memory into frames.',
      'Segmentation uses variable sizes.',
      'The TLB caches translations.',
      'Thrashing wastes CPU time.',
    ];
    const raw = bodies.map((body, i) => `CS301 Operating Systems\n${body}\nPage ${i + 1} of 4`);
    expect(buildBlocks(pages(...raw)).map((b) => b.text)).toEqual(bodies);
  });

  it('rejoins words hyphenated across lines and unwraps paragraphs', () => {
    const [block] = buildBlocks(
      pages('Memory frag-\nmentation happens when\nfree space is split.'),
    );
    expect(block.text).toBe('Memory fragmentation happens when free space is split.');
  });

  it('recognises headings without mistaking sentences for them', () => {
    const outline = new Set(['memory basics']);
    expect(isHeading('3.2 Page Replacement', outline)).toBe(true);
    expect(isHeading('Chapter 4 Deadlocks', outline)).toBe(true);
    expect(isHeading('VIRTUAL MEMORY', outline)).toBe(true);
    expect(isHeading('Memory basics', outline)).toBe(true);
    expect(isHeading('The kernel schedules processes.', outline)).toBe(false);
    expect(isHeading('A page fault occurs when a process touches an unmapped page', outline)).toBe(
      false,
    );
  });

  it('keeps bullet points as separate blocks', () => {
    const blocks = buildBlocks(
      pages('Causes of deadlock:\n• Mutual exclusion\n• Hold and wait\nthat continues here'),
    );
    expect(blocks.map((b) => b.text)).toEqual([
      'Causes of deadlock:',
      '• Mutual exclusion',
      '• Hold and wait that continues here',
    ]);
  });
});
