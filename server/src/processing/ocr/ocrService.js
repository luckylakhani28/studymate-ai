import { createWorker } from 'tesseract.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let workerPromise = null;

/** One Tesseract worker per process, created lazily and reused: startup costs seconds, a page doesn't. */
function getWorker() {
  workerPromise ??= createWorker(env.OCR_LANGS, 1 /* LSTM engine */, {
    cachePath: env.OCR_CACHE_DIR,
    errorHandler: (err) => logger.error({ err }, 'Tesseract worker error'),
  }).catch((err) => {
    workerPromise = null; // a failed init (e.g. language download) must not poison future jobs
    throw err;
  });
  return workerPromise;
}

async function resetWorker() {
  const pending = workerPromise;
  workerPromise = null;
  const worker = await pending?.catch(() => null);
  await worker?.terminate().catch(() => {});
}

/** Recognizes printed text in an image. Terminating the worker is the only way to cancel a page mid-OCR. */
export async function recognizeImage(image, { signal } = {}) {
  signal?.throwIfAborted();
  const worker = await getWorker();
  const onAbort = () => void resetWorker();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const { data } = await worker.recognize(image);
    return { text: data.text ?? '', confidence: data.confidence ?? 0 };
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

export const shutdownOcr = resetWorker;
