import { describe, it, expect } from 'vitest';
import {
  finalizePage,
  mergeOcrResult,
  summarizeExtraction,
} from '../../src/processing/ocr/mergeOcr.js';

const page = (overrides) => ({
  pageNumber: 1,
  text: '',
  charCount: 0,
  quality: 'scanned',
  ...overrides,
});
const gibberish = '\uE000'.repeat(50);

describe('OCR merge rules', () => {
  it('replaces a garbled text layer with OCR text', () => {
    const merged = mergeOcrResult(page({ quality: 'garbled', text: gibberish, charCount: 50 }), {
      text: 'Virtual memory lets a process use more memory than is physically installed.',
      confidence: 88,
    });
    expect(merged).toMatchObject({ source: 'ocr', confidence: 88 });
    expect(merged.text).toContain('Virtual memory');
  });

  it('keeps the native text of an image-heavy page when OCR found less', () => {
    const native = 'Lecture 6: Memory management and paging in operating systems';
    const merged = mergeOcrResult(page({ quality: 'image-heavy', text: native, charCount: 53 }), {
      text: 'Lecture 6',
      confidence: 90,
    });
    expect(merged).toMatchObject({ source: 'text', text: native });
  });

  it('discards OCR output below the confidence floor', () => {
    const merged = mergeOcrResult(page({ quality: 'scanned' }), {
      text: 'x7 ;; ~~ lI|',
      confidence: 12,
    });
    expect(merged).toMatchObject({ source: 'text', charCount: 0 });
  });

  it('drops garbled text that was never OCR-ed', () => {
    expect(
      finalizePage(page({ quality: 'garbled', text: gibberish, charCount: 50 })),
    ).toMatchObject({
      text: '',
      charCount: 0,
      source: 'text',
    });
  });

  it('summarizes a mixed extraction with char-weighted confidence', () => {
    const pages = [
      { pageNumber: 1, text: 'a', charCount: 100, quality: 'text', source: 'text' },
      {
        pageNumber: 2,
        text: 'b',
        charCount: 300,
        quality: 'scanned',
        source: 'ocr',
        confidence: 90,
      },
      {
        pageNumber: 3,
        text: 'c',
        charCount: 100,
        quality: 'scanned',
        source: 'ocr',
        confidence: 50,
      },
    ];
    expect(summarizeExtraction(pages, [4])).toMatchObject({
      method: 'mixed',
      ocrPages: [2, 3],
      lowConfidencePages: [3],
      ocrSkippedPages: [4],
      avgOcrConfidence: 80, // (90×300 + 50×100) / 400
    });
  });
});
