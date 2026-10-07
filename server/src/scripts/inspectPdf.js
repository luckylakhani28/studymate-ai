// Usage: npm run inspect-pdf -w server -- /absolute/path/to/file.pdf [--ocr] [--chunks]
import { readFile } from 'node:fs/promises';
import { openPdf } from '../processing/pdf/extractText.js';
import { needsOcr } from '../processing/pdf/pageQuality.js';
import { recognizeImage, shutdownOcr } from '../processing/ocr/ocrService.js';
import { finalizePage, mergeOcrResult } from '../processing/ocr/mergeOcr.js';
import { buildBlocks } from '../processing/text/normalize.js';
import { chunkBlocks } from '../processing/text/chunk.js';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error(
    'Usage: npm run inspect-pdf -w server -- /absolute/path/to/file.pdf [--ocr] [--chunks]',
  );
  process.exit(1);
}
const withOcr = flags.includes('--ocr');
const showChunks = flags.includes('--chunks');
const preview = (text, n = 70) => text.replace(/\s+/g, ' ').trim().slice(0, n);

const pdf = await openPdf(await readFile(file), { maxPages: 2000 });
console.log(`${pdf.numPages} pages, title: ${pdf.info.title ?? '(none)'}\n`);
const pages = [];

try {
  for (let n = 1; n <= pdf.numPages; n += 1) {
    let page = await pdf.extractPage(n);
    console.log(
      `p${String(n).padStart(4)}  ${page.quality.padEnd(11)} ${String(page.charCount).padStart(6)} chars  ${preview(page.text)}`,
    );
    if (withOcr && needsOcr(page.quality)) {
      const started = Date.now();
      const ocr = await recognizeImage(await pdf.renderPage(n));
      console.log(
        `       ocr ${Math.round(ocr.confidence)}% in ${Date.now() - started} ms  ${preview(ocr.text)}`,
      );
      page = mergeOcrResult(page, ocr);
    }
    pages.push(finalizePage(page));
  }

  if (showChunks) {
    const outline = await pdf.getOutline();
    const chunks = chunkBlocks(buildBlocks(pages, { outline }));
    console.log(`\n${outline.length} outline entries, ${chunks.length} chunks`);
    for (const c of chunks) {
      const section = c.sectionTitle ? `  [${c.sectionTitle}]` : '';
      console.log(
        `\n#${c.index}  pages ${c.pageStart}-${c.pageEnd}  ~${c.tokenCount} tokens${section}\n${preview(c.text, 300)}`,
      );
    }
  }
} finally {
  await pdf.close();
  await shutdownOcr();
}
