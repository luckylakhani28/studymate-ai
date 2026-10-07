import { AppError } from '../../utils/AppError.js';
import { JobError } from '../errors.js';

const UNSET_LOCK = { 'processing.lockedBy': 1, 'processing.lockedAt': 1, 'processing.stage': 1 };

/** Persistence for any collection with the { status, processing.* } job shape. */
export function createMongoQueue({ name, Model, process, initialStage }) {
  // Every write after the claim is guarded by "I still hold the lock": no ghost updates.
  const owned = (job, workerId) => ({
    _id: job._id,
    status: 'processing',
    'processing.lockedBy': workerId,
  });

  return {
    name,
    process,

    /** Atomic claim: a due queued job, or a processing job whose worker stopped heartbeating. */
    claim(workerId, lockTtlMs) {
      const now = new Date();
      return Model.findOneAndUpdate(
        {
          $or: [
            {
              status: 'queued',
              $or: [
                { 'processing.availableAt': null },
                { 'processing.availableAt': { $lte: now } },
              ],
            },
            {
              status: 'processing',
              'processing.lockedAt': { $lt: new Date(now.getTime() - lockTtlMs) },
            },
          ],
        },
        {
          $set: {
            status: 'processing',
            'processing.lockedBy': workerId,
            'processing.lockedAt': now,
            'processing.startedAt': now,
            'processing.stage': initialStage,
            'processing.progress': 0,
          },
          $inc: { 'processing.attempts': 1 },
        },
        { sort: { createdAt: 1 }, new: true }, // FIFO
      );
    },

    async heartbeat(job, workerId) {
      const res = await Model.updateOne(owned(job, workerId), {
        $set: { 'processing.lockedAt': new Date() },
      });
      return res.matchedCount === 1;
    },

    progress: (job, workerId, stage, pct) =>
      Model.updateOne(owned(job, workerId), {
        $set: { 'processing.stage': stage, 'processing.progress': pct },
      }),

    /** Marks the job ready with extra fields. Returns false if we had lost the lock. */
    async markReady(job, workerId, fields) {
      const res = await Model.updateOne(owned(job, workerId), {
        $set: {
          ...fields,
          status: 'ready',
          'processing.progress': 100,
          'processing.finishedAt': new Date(),
        },
        $unset: { ...UNSET_LOCK, 'processing.lastError': 1, 'processing.availableAt': 1 },
      });
      return res.matchedCount === 1;
    },

    fail(job, workerId, err, retryAt) {
      // JobError and AppError messages come from our own catalog, so they're safe to show. Anything else is hidden.
      const safe = err instanceof JobError || err instanceof AppError;
      const $set = {
        status: retryAt ? 'queued' : 'failed',
        'processing.lastError': {
          code: safe ? err.code : 'PROCESSING_FAILED',
          message: safe ? err.message : 'Processing failed unexpectedly.',
          at: new Date(),
        },
      };
      if (retryAt) $set['processing.availableAt'] = retryAt;
      else $set['processing.finishedAt'] = new Date();
      return Model.updateOne(owned(job, workerId), { $set, $unset: UNSET_LOCK });
    },

    /** Shutdown interrupted the job: hand it back without spending an attempt. */
    release: (job, workerId) =>
      Model.updateOne(owned(job, workerId), {
        $set: { status: 'queued', 'processing.availableAt': new Date() },
        $inc: { 'processing.attempts': -1 },
        $unset: UNSET_LOCK,
      }),
  };
}
