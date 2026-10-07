import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, isProd } from './config/env.js';
import { httpLogger } from './middleware/httpLogger.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { apiV1Router } from './routes/index.js';

/** Production: the API also serves the built React app, so browser and API share one origin. */
function serveClient(app, dir) {
  app.use('/assets', express.static(path.join(dir, 'assets'), { immutable: true, maxAge: '1y' })); // hashed names
  app.use(express.static(dir, { index: false }));
  // SPA fallback: any non-API GET returns index.html, and React Router takes it from there.
  app.get(/^(?!\/api\/).*/, (_req, res) =>
    res.sendFile(path.join(dir, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }),
  );
}

export function createApp() {
  const app = express();

  // Behind the host's proxy, so req.ip (used by rate limiting) is the real client IP.
  if (isProd) app.set('trust proxy', 1);

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter); // before the limiter: uptime monitors aren't throttled
  app.use('/api', globalLimiter);
  app.use('/api/v1', apiV1Router);

  if (env.SERVE_CLIENT_DIR) serveClient(app, env.SERVE_CLIENT_DIR);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
