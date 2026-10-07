import { measureText } from '../pdf/pageQuality.js';

export const OCR_THRESHOLDS = Object.freeze({
  lowConfidence: 60, // kept, but flagged so the UI (and the AI) can treat it with caution
  discardBelow: 30, // almost always noise: photos, diagrams, speckle
});

/** Never keep gibberish: a garbled text layer that wasn't replaced by OCR becomes empty. */
export function finalizePage(page) {
  if (page.source === 'ocr') return page;
  if (page.quality === 'garbled') return { ...page, text: '', charCount: 0, source: 'text' };
  return { ...page, source: 'text' };
}

/** Chooses between a page's native text and its OCR text. */
export function mergeOcrResult(page, ocr) {
  const text = ocr.text.trim();
  const chars = measureText(text).chars;
  const usable = chars > 0 && ocr.confidence >= OCR_THRESHOLDS.discardBelow;
  const brokenLayer = page.quality === 'garbled' || page.quality === 'scanned';

  // Image-heavy pages already have *some* exact text: only switch if OCR found more.
  if (usable && (brokenLayer || chars > page.charCount)) {
    return {
      ...page,
      text,
      charCount: chars,
      source: 'ocr',
      confidence: Math.round(ocr.confidence),
    };
  }
  return finalizePage({ ...page, source: 'text' });
}

export function summarizeExtraction(pages, ocrSkippedPages = []) {
  const ocr = pages.filter((p) => p.source === 'ocr');
  const withContent = pages.filter((p) => p.charCount > 0);
  const ocrChars = ocr.reduce((sum, p) => sum + p.charCount, 0);

  return {
    method: ocr.length === 0 ? 'text' : ocr.length === withContent.length ? 'ocr' : 'mixed',
    ocrPages: ocr.map((p) => p.pageNumber),
    lowConfidencePages: ocr
      .filter((p) => p.confidence < OCR_THRESHOLDS.lowConfidence)
      .map((p) => p.pageNumber),
    ocrSkippedPages,
    // Char-weighted: a dense, confident page counts for more than a sparse, unsure one.
    avgOcrConfidence: ocrChars
      ? Math.round(ocr.reduce((s, p) => s + p.confidence * p.charCount, 0) / ocrChars)
      : undefined,
    pageStats: pages.map((p) => ({
      page: p.pageNumber,
      chars: p.charCount,
      quality: p.quality,
      source: p.source,
      confidence: p.confidence,
    })),
  };
}
