import { describe, it, expect } from 'vitest';
import { extractPdfText } from '../../src/processing/pdf/extractText.js';
import { makePdf, LOREM } from '../helpers/pdfFixtures.js';

describe('extractPdfText', () => {
  it('extracts text per page and classifies each page', async () => {
    const result = await extractPdfText(await makePdf([{ text: LOREM }, {}, { image: true }]), {
      maxPages: 10,
    });
    expect(result.pageCount).toBe(3);
    expect(result.pages.map((p) => p.quality)).toEqual(['text', 'blank', 'scanned']);
    expect(result.pages[0].text).toContain('Paging splits memory');
  });

  it('rejects PDFs over the page limit as a permanent error', async () => {
    const bytes = await makePdf([{ text: LOREM }, { text: LOREM }, { text: LOREM }]);
    await expect(extractPdfText(bytes, { maxPages: 2 })).rejects.toMatchObject({
      code: 'TOO_MANY_PAGES',
      retryable: false,
    });
  });

  it('maps corrupt files to CORRUPT_PDF', async () => {
    await expect(
      extractPdfText(Buffer.from('%PDF-1.7\nnot really a pdf'), { maxPages: 10 }),
    ).rejects.toMatchObject({
      code: 'CORRUPT_PDF',
      retryable: false,
    });
  });
});
