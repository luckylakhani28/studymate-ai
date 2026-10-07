import { logger } from '../utils/logger.js';
import { JobError, LockLostError, ShutdownError, permanentError } from './errors.js';

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** Stop waiting the moment the signal aborts, even if a handler ignores it. */
const raceAbort = (promise, signal) =>
  new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    promise.then(resolve, reject);
  });

/** 30s, 60s, 120s… capped at 10 min, ±20% jitter so retries don't stampede together. */
const backoffMs = (attempt) =>
  Math.round(Math.min(30_000 * 2 ** (attempt - 1), 600_000) * (0.8 + Math.random() * 0.4));

/**
 * Owns POLICY (loop, timeouts, heartbeats, retry decisions). Queues own PERSISTENCE,
 * so new job types plug in without touching this file.
 */
export class JobRunner {
  #stopping = new AbortController();
  #current = null;
  #loopPromise = null;

  constructor({ workerId, queues, pollIntervalMs, lockTtlMs, jobTimeoutMs, maxAttempts }) {
    Object.assign(this, { workerId, queues, pollIntervalMs, lockTtlMs, jobTimeoutMs, maxAttempts });
  }

  start() {
    logger.info(
      { workerId: this.workerId, queues: this.queues.map((q) => q.name) },
      'Worker started',
    );
    this.#loopPromise = this.#loop();
  }

  async stop({ graceMs = 20_000 } = {}) {
    this.#stopping.abort();
    const current = this.#current;
    const force = current && setTimeout(() => current.abort(new ShutdownError()), graceMs);
    await this.#loopPromise;
    clearTimeout(force);
  }

  /** Processes at most one job. Returns true if it did work. The loop and the tests both use this. */
  async runOnce() {
    for (const queue of this.queues) {
      const job = await queue.claim(this.workerId, this.lockTtlMs);
      if (job) {
        await this.#execute(queue, job);
        return true;
      }
    }
    return false;
  }

  async #loop() {
    while (!this.#stopping.signal.aborted) {
      let worked = false;
      try {
        worked = await this.runOnce();
      } catch (err) {
        logger.error({ err }, 'Worker loop error'); // e.g. a DB blip: keep the worker alive
      }
      if (!worked) await sleep(this.pollIntervalMs, this.#stopping.signal); // drain fast, idle slowly
    }
  }

  async #execute(queue, job) {
    const attempt = job.processing.attempts;
    const log = logger.child({ queue: queue.name, jobId: String(job._id), attempt });

    if (attempt > this.maxAttempts) {
      // Reached via stale-lock reclaims: a file that crashes the worker every time must not loop forever.
      await queue.fail(
        job,
        this.workerId,
        permanentError('MAX_ATTEMPTS_EXCEEDED', 'Processing failed repeatedly. Try again later.'),
        null,
      );
      log.error('Job exceeded max attempts');
      return;
    }

    const controller = new AbortController();
    this.#current = controller;
    const timeout = setTimeout(
      () => controller.abort(new JobError('JOB_TIMEOUT', 'Processing took too long.')),
      this.jobTimeoutMs,
    );
    const heartbeat = setInterval(
      () => {
        queue
          .heartbeat(job, this.workerId)
          .then((alive) => alive || controller.abort(new LockLostError()))
          .catch((err) => log.warn({ err }, 'Heartbeat failed'));
      },
      Math.max(1000, this.lockTtlMs / 3),
    );

    const ctx = {
      signal: controller.signal,
      log,
      progress: (stage, pct) => queue.progress(job, this.workerId, stage, pct).catch(() => {}),
    };
    const startedAt = Date.now();

    try {
      const result = await raceAbort(queue.process(job, ctx), controller.signal);
      await queue.complete(job, this.workerId, result);
      log.info({ ms: Date.now() - startedAt }, 'Job completed');
    } catch (thrown) {
      const err = controller.signal.aborted ? controller.signal.reason : thrown;
      if (err instanceof LockLostError) {
        log.warn('Lost job lock (record deleted or reclaimed); abandoning');
        return;
      }
      if (err instanceof ShutdownError) {
        await queue.release(job, this.workerId);
        log.info('Released job for another worker');
        return;
      }
      const retry = err.retryable !== false && attempt < this.maxAttempts;
      const retryAt = retry ? new Date(Date.now() + backoffMs(attempt)) : null;
      await queue.fail(job, this.workerId, err, retryAt);
      log[retry ? 'warn' : 'error'](
        { err, retryAt },
        retry ? 'Job failed; will retry' : 'Job failed permanently',
      );
    } finally {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      this.#current = null;
    }
  }
}
