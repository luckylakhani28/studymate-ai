/** An error whose message is safe to show users. `retryable: false` means don't bother retrying. */
export class JobError extends Error {
  constructor(code, message, { retryable = true } = {}) {
    super(message);
    this.name = 'JobError';
    this.code = code;
    this.retryable = retryable;
  }
}

export const permanentError = (code, message) => new JobError(code, message, { retryable: false });

/** The job's record was deleted or reclaimed by another worker: stop quietly. */
export class LockLostError extends Error {
  name = 'LockLostError';
}

/** The worker is shutting down: release the job for another worker. */
export class ShutdownError extends Error {
  name = 'ShutdownError';
}
