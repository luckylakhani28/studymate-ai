import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { storage } from '../../storage/index.js';
import { openPdf } from '../../processing/pdf/extractText.js';
import { needsOcr } from '../../processing/pdf/pageQuality.js';
import { recognizeImage } from '../../processing/ocr/ocrService.js';
import {
  finalizePage,
  mergeOcrResult,
  summarizeExtraction,
} from '../../processing/ocr/mergeOcr.js';
import { buildBlocks } from '../../processing/text/normalize.js';
import { chunkBlocks } from '../../processing/text/chunk.js';
import { EMBEDDING_MODEL_ID, embedDocuments } from '../../ai/embeddings.js';
import { permanentError } from '../errors.js';
import { createProgressReporter } from '../progress.js';

// Share of the progress bar per stage.
const PLAN = { extracting: [0, 10], ocr: [10, 70], chunking: [70, 72], embedding: [72, 100] };

async function loadFile(storageKey) {
  try {
    return await storage.getBuffer(storageKey);
  } catch (err) {
    if (err.code === 'NOT_FOUND')
      throw permanentError('FILE_MISSING', 'The uploaded file is missing. Upload it again.');
    throw err;
  }
}

/** Tags each chunk with where its text came from, so answers can be cautious about weak OCR. */
function withProvenance(chunk, ocrPages, lowConfidencePages) {
  const range = Array.from(
    { length: chunk.pageEnd - chunk.pageStart + 1 },
    (_, i) => chunk.pageStart + i,
  );
  const ocrCount = range.filter((p) => ocrPages.has(p)).length;
  return {
    ...chunk,
    source: ocrCount === 0 ? 'text' : ocrCount === range.length ? 'ocr' : 'mixed',
    lowConfidence: range.some((p) => lowConfidencePages.has(p)),
  };
}

/** Contextual embedding: "3.2 Page Replacement\n<text>" retrieves better than the bare passage. */
const embeddingInput = (chunk) =>
  chunk.sectionTitle && !chunk.text.startsWith(chunk.sectionTitle)
    ? `${chunk.sectionTitle}\n${chunk.text}`
    : chunk.text;

export async function processDocument(job, { signal, progress, log }) {
  const stage = createProgressReporter(progress);
  const pdf = await openPdf(await loadFile(job.storageKey), { maxPages: env.MAX_PDF_PAGES });
  const pages = [];
  let outline = [];
  let ocrSkippedPages = [];
  let ocrAttempted = false;

  try {
    // Pass 1: trust the PDF's own text layer wherever it is usable. Fast and exact.
    const reportExtract = stage('extracting', ...PLAN.extracting);
    for (let n = 1; n <= pdf.numPages; n += 1) {
      signal.throwIfAborted();
      pages.push(await pdf.extractPage(n));
      reportExtract(n / pdf.numPages);
    }
    outline = await pdf.getOutline();

    // Pass 2: OCR only the pages whose text layer is missing or broken. Slow and approximate.
    const candidates = pages.filter((p) => needsOcr(p.quality));
    const toOcr = candidates.slice(0, env.OCR_MAX_PAGES);
    ocrSkippedPages = candidates.slice(env.OCR_MAX_PAGES).map((p) => p.pageNumber);

    if (toOcr.length > 0) {
      ocrAttempted = true;
      log.info({ pages: toOcr.length, skipped: ocrSkippedPages.length }, 'Running OCR');
      const reportOcr = stage('ocr', ...PLAN.ocr);
      for (const [i, page] of toOcr.entries()) {
        signal.throwIfAborted();
        let image;
        try {
          image = await pdf.renderPage(page.pageNumber, { dpi: env.OCR_DPI });
        } catch (err) {
          // One unrenderable page shouldn't sink a 200-page document.
          log.warn({ err, page: page.pageNumber }, 'Page render failed; skipping OCR for it');
          continue;
        }
        // OCR engine failures propagate: they're retryable.
        pages[page.pageNumber - 1] = mergeOcrResult(page, await recognizeImage(image, { signal }));
        reportOcr((i + 1) / toOcr.length);
      }
    }
  } finally {
    await pdf.close();
  }

  const finalPages = pages.map(finalizePage);
  if (finalPages.reduce((sum, p) => sum + p.charCount, 0) < 40) {
    throw permanentError(
      'NO_EXTRACTABLE_TEXT',
      ocrAttempted
        ? 'No readable text was found in this PDF, even after scanning its pages.'
        : 'No readable text was found in this PDF.',
    );
  }

  // Clean, normalize, chunk.
  const reportChunking = stage('chunking', ...PLAN.chunking);
  const extraction = summarizeExtraction(finalPages, ocrSkippedPages);
  const blocks = buildBlocks(finalPages, { outline });
  const ocrPages = new Set(extraction.ocrPages);
  const lowPages = new Set(extraction.lowConfidencePages);
  const chunks = chunkBlocks(blocks).map((c) => withProvenance(c, ocrPages, lowPages));
  reportChunking(1);

  if (chunks.length === 0) {
    throw permanentError(
      'NO_EXTRACTABLE_TEXT',
      'No readable text was left after cleaning this PDF.',
    );
  }

  // Embed.
  const reportEmbedding = stage('embedding', ...PLAN.embedding);
  const vectors = await embedDocuments(chunks.map(embeddingInput), {
    signal,
    onProgress: reportEmbedding,
  });
  chunks.forEach((chunk, i) => {
    chunk.embedding = vectors[i];
  });

  const cleanText = blocks.map((b) => b.text).join('\n');
  return {
    pageCount: finalPages.length,
    extraction,
    stats: {
      charCount: cleanText.length,
      chunkCount: chunks.length,
      tokenCount: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    },
    metadata: {
      title: pdf.info.title,
      author: pdf.info.author,
      outline: outline.length ? outline : undefined,
    },
    contentHash: createHash('sha256').update(cleanText).digest('hex'), // study-tool cache key
    embeddingModel: EMBEDDING_MODEL_ID,
    chunks,
  };
}
