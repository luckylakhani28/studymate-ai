import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const LOREM =
  'Paging splits memory into fixed-size frames, so a process no longer needs one contiguous block. ' +
  'The price is translation: every address has to be looked up in the page table. A TLB caches ' +
  'recent translations, so most lookups never reach the page table at all.';

/** A "photo" of printed text: what a scanner or phone camera produces. */
export function textImagePng(lines) {
  const canvas = createCanvas(2000, 120 + lines.length * 90);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.font = '60px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 80, 120 + i * 90));
  return canvas.toBuffer('image/png');
}

/** pages: [{ text?, image? }] — image is `true` (a 1-pixel full-page image) or a PNG buffer. */
export async function makePdf(pages) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pixel = await pdf.embedPng(PIXEL_PNG);
  for (const spec of pages) {
    const page = pdf.addPage([595, 842]);
    if (spec.image) {
      const img = Buffer.isBuffer(spec.image) ? await pdf.embedPng(spec.image) : pixel;
      const height = Buffer.isBuffer(spec.image) ? (595 * img.height) / img.width : 842;
      page.drawImage(img, { x: 0, y: 842 - height, width: 595, height });
    }
    if (spec.text)
      page.drawText(spec.text, { x: 50, y: 780, size: 11, font, maxWidth: 495, lineHeight: 14 });
  }
  return Buffer.from(await pdf.save());
}
