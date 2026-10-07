import { hostname } from 'node:os';
import { env } from '../config/env.js';
import { JobRunner } from './JobRunner.js';
import { createDocumentQueue } from './queues/documentQueue.js';
import { createArtifactQueue } from './queues/artifactQueue.js';

/** One runner, two queues: PDF processing first, then AI study tools. Used by worker.js and inline mode. */
export const createJobRunner = () =>
  new JobRunner({
    workerId: `${hostname()}:${process.pid}`,
    queues: [createDocumentQueue(), createArtifactQueue()],
    pollIntervalMs: env.WORKER_POLL_MS,
    lockTtlMs: env.JOB_LOCK_TTL_MS,
    jobTimeoutMs: env.JOB_TIMEOUT_MS,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
  });
