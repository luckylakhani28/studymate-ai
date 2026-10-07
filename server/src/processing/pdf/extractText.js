import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument, GlobalWorkerOptions, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { permanentError } from '../../jobs/errors.js';
import { QUALITY_THRESHOLDS, classifyPage, measureText } from './pageQuality.js';

const require = createRequire(import.meta.url);
const PDFJS_DIR = path.dirname(require.resolve('pdfjs-dist/package.json'));
// require.resolve + pathToFileURL instead of import.meta.resolve: the latter is missing under Vitest's transform.
GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

const BASE_OPTIONS = {
  isEvalSupported: false, // never compile code from PDF content (hardening against malicious PDFs)
  disableFontFace: true, // Node: draw glyphs as paths
  useSystemFonts: false,
  verbosity: 0,
  standardFontDataUrl: path.join(PDFJS_DIR, 'standard_fonts') + path.sep,
  cMapUrl: path.join(PDFJS_DIR, 'cmaps') + path.sep, // CJK and other non-Latin encodings
  cMapPacked: true,
  wasmUrl: path.join(PDFJS_DIR, 'wasm') + path.sep, // JPEG 2000 / JBIG2 decoders: common in scans
};

const IMAGE_OPS = new Set([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintImageXObjectRepeat,
]);

function mapLoadError(err) {
  if (err?.name === 'PasswordException') {
    return permanentError(
      'PASSWORD_PROTECTED',
      'This PDF is password-protected. Remove the password and upload it again.',
    );
  }
  if (err?.name === 'InvalidPDFException' || err?.name === 'FormatError') {
    return permanentError('CORRUPT_PDF', 'This file is damaged or isn’t a valid PDF.');
  }
  return err;
}

function pageText(content) {
  let text = '';
  for (const item of content.items) {
    if (!('str' in item)) continue; // skip marked-content markers
    text += item.str + (item.hasEOL ? '\n' : '');
  }
  return text;
}

async function pageHasImages(page) {
  const { fnArray } = await page.getOperatorList();
  return fnArray.some((fn) => IMAGE_OPS.has(fn));
}

async function resolveDestPage(pdf, dest) {
  try {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    const ref = Array.isArray(explicit) ? explicit[0] : null;
    if (ref == null) return undefined;
    return typeof ref === 'number' ? ref + 1 : (await pdf.getPageIndex(ref)) + 1;
  } catch {
    return undefined; // broken bookmarks are common; a missing page number is fine
  }
}

const cleanMeta = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : undefined;

/** Opens a PDF once; callers extract, render, and read the outline, then must call close(). */
export async function openPdf(data, { maxPages }) {
  const loadingTask = getDocument({ ...BASE_OPTIONS, data: new Uint8Array(data) });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    await loadingTask.destroy().catch(() => {});
    throw mapLoadError(err);
  }

  if (pdf.numPages > maxPages) {
    await pdf.destroy();
    throw permanentError(
      'TOO_MANY_PAGES',
      `This PDF has ${pdf.numPages} pages. The limit is ${maxPages}.`,
    );
  }
  const { info } = await pdf.getMetadata().catch(() => ({ info: {} }));

  return {
    numPages: pdf.numPages,
    info: { title: cleanMeta(info?.Title), author: cleanMeta(info?.Author) },

    async extractPage(n) {
      const page = await pdf.getPage(n);
      try {
        const text = pageText(await page.getTextContent());
        const metrics = measureText(text);
        // The operator list is relatively expensive, so only inspect images on low-text pages.
        const hasImages =
          metrics.chars < QUALITY_THRESHOLDS.imageHeavyChars && (await pageHasImages(page));
        return {
          pageNumber: n,
          text,
          charCount: metrics.chars,
          quality: classifyPage(metrics, hasImages),
        };
      } finally {
        page.cleanup(); // free per-page memory: matters on 300-page PDFs
      }
    },

    /** PNG for OCR. Resolution is DPI-based, but the longest side is capped to bound memory. */
    async renderPage(n, { dpi = 200, maxSide = 2400 } = {}) {
      const page = await pdf.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 }); // 1 unit = 1/72 inch
        const scale = Math.min(dpi / 72, maxSide / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height); // transparent pixels would OCR as black
        await page.render({ canvasContext: ctx, viewport }).promise;
        return await canvas.encode('png');
      } finally {
        page.cleanup();
      }
    },

    /** The PDF's bookmarks, flattened: [{ title, level, page }]. */
    async getOutline({ maxItems = 200, maxDepth = 3 } = {}) {
      const items = await pdf.getOutline().catch(() => null);
      const out = [];
      const walk = async (nodes, level) => {
        if (!nodes || level > maxDepth) return;
        for (const node of nodes) {
          if (out.length >= maxItems) return;
          const title = cleanMeta(node.title);
          if (title)
            out.push({
              title: title.slice(0, 200),
              level,
              page: await resolveDestPage(pdf, node.dest),
            });
          await walk(node.items, level + 1);
        }
      };
      await walk(items, 1);
      return out;
    },

    close: () => pdf.destroy(),
  };
}

/** Text-only convenience wrapper (used by tests and simple callers). */
export async function extractPdfText(data, { maxPages, signal, onPage } = {}) {
  const pdf = await openPdf(data, { maxPages });
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      signal?.throwIfAborted();
      pages.push(await pdf.extractPage(n));
      onPage?.(n, pdf.numPages);
    }
    return { pageCount: pdf.numPages, info: pdf.info, pages };
  } finally {
    await pdf.close();
  }
}
