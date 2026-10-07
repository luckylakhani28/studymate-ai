// Usage: npm run prefetch-models -w server
// Downloads the embedding model and OCR language data into their caches. Used by the Docker build so
// containers start ready instead of downloading on the first request. Needs no database or .env.
import path from 'node:path';
import { pipeline, env as hf } from '@huggingface/transformers';
import { createWorker } from 'tesseract.js';

hf.cacheDir = path.resolve(process.env.EMBEDDING_CACHE_DIR ?? './.model-cache');
await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' });
console.log('Embedding model cached in', hf.cacheDir);

const worker = await createWorker(process.env.OCR_LANGS ?? 'eng', 1, {
  cachePath: path.resolve(process.env.OCR_CACHE_DIR ?? './.ocr-cache'),
});
await worker.terminate();
console.log('OCR language data cached');
