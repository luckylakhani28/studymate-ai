import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';
import { warmUpEmbeddings } from './ai/embeddings.js';

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

async function start() {
  await connectDB();
  const app = createApp();

  // Single-service hosting: run the job worker inside this process (loaded only when enabled).
  const runner = env.RUN_WORKER_IN_API
    ? (await import('./jobs/createJobRunner.js')).createJobRunner()
    : null;

  // Express 5 passes listen errors (e.g. EADDRINUSE) to this callback.
  const server = app.listen(env.PORT, (err) => {
    if (err) {
      logger.fatal({ err }, `Cannot listen on port ${env.PORT}`);
      process.exit(1);
    }
    logger.info(`API listening on http://localhost:${env.PORT}`);
    if (env.EMBEDDING_PROVIDER === 'local') {
      warmUpEmbeddings()
        .then(() => logger.info('Embedding model ready'))
        .catch((e) =>
          logger.warn({ err: e }, 'Embedding warm-up failed; the first search will load it'),
        );
    }
    runner?.start();
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, 25_000).unref();

    // Stop accepting connections and let in-flight requests (and the current job) finish.
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      runner?.stop({ graceMs: 20_000 }),
    ]);
    if (runner) await (await import('./processing/ocr/ocrService.js')).shutdownOcr();
    await disconnectDB();
    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
