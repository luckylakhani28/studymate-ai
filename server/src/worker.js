import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { createJobRunner } from './jobs/createJobRunner.js';
import { shutdownOcr } from './processing/ocr/ocrService.js';

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled promise rejection in worker');
  process.exit(1); // the job lock expires and another worker reclaims the job
});

const runner = createJobRunner();

await connectDB();
runner.start();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker shutting down');
  await runner.stop({ graceMs: 20_000 }); // finish the current job, or release it after 20s
  await shutdownOcr(); // terminate Tesseract's worker thread, or the process can't exit
  await disconnectDB();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
