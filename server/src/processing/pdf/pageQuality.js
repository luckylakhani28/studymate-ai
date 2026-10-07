export const QUALITY_THRESHOLDS = Object.freeze({
  minChars: 40, // below this a page has no meaningful text layer
  imageHeavyChars: 200, // an image page with only a header/footer still needs OCR
  minAlnumRatio: 0.5, // tolerant of math and code, which are symbol-heavy
  maxBadCharRatio: 0.05, // replacement chars or private-use glyphs: broken font encoding
});

export function measureText(text) {
  const visible = text.replace(/\s+/g, '');
  const chars = visible.length;
  if (chars === 0) return { chars: 0, alnumRatio: 0, badRatio: 0 };
  const alnum = (visible.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const bad = (visible.match(/[\uFFFD\p{Co}]/gu) ?? []).length;
  return { chars, alnumRatio: alnum / chars, badRatio: bad / chars };
}

/** Decides, per page, whether the PDF's own text layer can be trusted. */
export function classifyPage({ chars, alnumRatio, badRatio }, hasImages) {
  const t = QUALITY_THRESHOLDS;
  if (chars >= 20 && (alnumRatio < t.minAlnumRatio || badRatio > t.maxBadCharRatio))
    return 'garbled';
  if (chars < t.minChars) return hasImages ? 'scanned' : 'blank';
  if (hasImages && chars < t.imageHeavyChars) return 'image-heavy';
  return 'text';
}

export const needsOcr = (quality) =>
  quality === 'scanned' || quality === 'garbled' || quality === 'image-heavy';
