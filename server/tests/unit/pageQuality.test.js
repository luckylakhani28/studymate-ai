import { describe, it, expect } from 'vitest';
import { classifyPage, measureText } from '../../src/processing/pdf/pageQuality.js';

describe('classifyPage', () => {
  it.each([
    [
      'normal prose',
      'Paging splits memory into fixed-size frames so a process needs no contiguous block.',
      false,
      'text',
    ],
    ['an empty page', '   \n  ', false, 'blank'],
    ['a scanned page', '', true, 'scanned'],
    [
      'a scan with a typed header',
      'Department of Computer Science, Operating Systems, Lecture 6',
      true,
      'image-heavy',
    ],
    ['broken font encoding', '\uE000\uE001\uE002'.repeat(12), false, 'garbled'],
  ])('classifies %s', (_label, text, hasImages, expected) => {
    expect(classifyPage(measureText(text), hasImages)).toBe(expected);
  });
});
