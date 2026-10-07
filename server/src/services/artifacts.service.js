import { createHash, randomUUID } from 'node:crypto';
import { StudyArtifact, StudyDocument } from '../models/index.js';
import { ARTIFACT_SPECS } from '../ai/artifactSpecs.js';
import { getPrompt } from '../ai/prompts/registry.js';
import { AppError } from '../utils/AppError.js';
import { assertWithinQuota } from './usage.service.js';

const notFound = (what) => new AppError('NOT_FOUND', { message: `${what} not found` });

/**
 * Same document text + same request + same prompt versions → same result, served from cache.
 * `regenerate` adds a nonce for a deliberately fresh quiz or flashcard set.
 */
export async function requestArtifact(
  userId,
  documentId,
  { type, options: rawOptions = {}, regenerate = false },
) {
  const doc = await StudyDocument.findOwned(documentId, userId, 'status contentHash');
  if (!doc) throw notFound('Document');
  if (doc.status !== 'ready') throw new AppError('DOCUMENT_NOT_READY');

  const spec = ARTIFACT_SPECS[type];
  const options = spec.options ? spec.options.parse(rawOptions) : {};
  const promptVersion = getPrompt(spec.prompt).version;
  const cacheKey = createHash('sha256')
    .update(
      JSON.stringify({
        contentHash: doc.contentHash,
        type,
        options,
        promptVersion,
        digestVersion: getPrompt('section_summary').version,
        nonce: regenerate ? randomUUID() : null,
      }),
    )
    .digest('hex');

  const existing = await StudyArtifact.findOne({ userId, cacheKey });
  if (existing?.status === 'ready') return { artifact: existing, cached: true };
  if (existing && existing.status !== 'failed') return { artifact: existing, cached: false }; // in progress

  await assertWithinQuota(userId); // fail fast before queueing paid work

  if (existing) {
    const retried = await StudyArtifact.findOneAndUpdate(
      { _id: existing._id, status: 'failed' },
      {
        $set: {
          status: 'queued',
          'processing.attempts': 0,
          'processing.progress': 0,
          'processing.availableAt': new Date(),
        },
        $unset: { 'processing.lastError': 1 },
      },
      { new: true },
    );
    return { artifact: retried ?? existing, cached: false };
  }

  try {
    const artifact = await StudyArtifact.create({
      userId,
      documentId: doc._id,
      type,
      options,
      cacheKey,
      promptVersion,
    });
    return { artifact, cached: false };
  } catch (err) {
    // Two identical requests raced; the unique index picked a winner, so return it.
    if (err?.code === 11000)
      return { artifact: await StudyArtifact.findOne({ userId, cacheKey }), cached: false };
    throw err;
  }
}

export async function listArtifacts(userId, documentId, { type, limit }) {
  const doc = await StudyDocument.findOwned(documentId, userId, '_id');
  if (!doc) throw notFound('Document');
  return StudyArtifact.find({ userId, documentId: doc._id, ...(type && { type }) })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export async function getArtifact(userId, id) {
  const artifact = await StudyArtifact.findOwned(id, userId);
  if (!artifact) throw notFound('Study item');
  return artifact;
}

export async function deleteArtifact(userId, id) {
  const res = await StudyArtifact.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw notFound('Study item');
}
