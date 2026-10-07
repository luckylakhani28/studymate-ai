import { createReadStream } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { StudyDocument, Chunk, StudyArtifact, Conversation } from '../models/index.js';
import { storage } from '../storage/index.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const PDF_SIGNATURE = Buffer.from('%PDF-');

/** The spec allows the header anywhere in the first 1024 bytes, so search, don't just compare byte 0. */
async function hasPdfSignature(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(1024), 0, 1024, 0);
    return buffer.subarray(0, bytesRead).includes(PDF_SIGNATURE);
  } finally {
    await handle.close();
  }
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk); // streams: constant memory
  return hash.digest('hex');
}

/** Busboy decodes filenames as latin1, so UTF-8 names (e.g. Hindi) arrive garbled. Repair, then sanitize. */
function sanitizeFilename(raw) {
  const alreadyUnicode = [...raw].some((ch) => ch.charCodeAt(0) > 255);
  const repaired = alreadyUnicode ? raw : Buffer.from(raw, 'latin1').toString('utf8');
  const decoded = repaired.includes('\uFFFD') ? raw : repaired;
  const base = decoded.split(/[\\/]/).pop();
  const printable = [...base]
    .filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join('');
  return (printable.trim() || 'document.pdf').slice(0, 255);
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const duplicateError = (documentId) =>
  new AppError('DUPLICATE_DOCUMENT', { details: { documentId: String(documentId) } });

async function findOwnedOrThrow(userId, id, projection) {
  const doc = await StudyDocument.findOwned(id, userId, projection);
  if (!doc) throw new AppError('NOT_FOUND', { message: 'Document not found' });
  return doc;
}

export async function uploadDocument(userId, file) {
  if (!file) {
    throw new AppError('VALIDATION_ERROR', {
      details: [{ field: 'file', message: 'Attach a PDF file' }],
    });
  }

  let storageKey = null;
  let fileHash = null;
  try {
    if (!(await hasPdfSignature(file.path))) throw new AppError('UNSUPPORTED_FILE');

    if ((await StudyDocument.countDocuments({ userId })) >= env.MAX_DOCUMENTS_PER_USER) {
      throw new AppError('DOCUMENT_LIMIT_REACHED');
    }

    fileHash = await sha256File(file.path);
    const existing = await StudyDocument.findOne({ userId, fileHash }, { _id: 1 });
    if (existing) throw duplicateError(existing._id);

    storageKey = `users/${userId}/${randomUUID()}.pdf`;
    await storage.putFile(storageKey, file.path);

    return await StudyDocument.create({
      userId,
      originalName: sanitizeFilename(file.originalname),
      storageKey,
      mimeType: 'application/pdf',
      sizeBytes: file.size,
      fileHash,
    });
  } catch (err) {
    if (storageKey) await storage.remove(storageKey).catch(() => {});
    // Two identical uploads raced past the findOne check: the unique index caught it.
    if (err?.code === 11000) {
      const winner = await StudyDocument.findOne({ userId, fileHash }, { _id: 1 });
      throw duplicateError(winner?._id);
    }
    throw err;
  } finally {
    await unlink(file.path).catch(() => {}); // already moved on success; ENOENT is fine
  }
}

export async function listDocuments(userId, { page, limit, status, q }) {
  const filter = { userId };
  if (status) filter.status = status;
  if (q) filter.title = { $regex: escapeRegExp(q), $options: 'i' };

  const [documents, total] = await Promise.all([
    StudyDocument.find(filter)
      .select('-metadata.outline -extraction.pageStats')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    StudyDocument.countDocuments(filter),
  ]);
  return { documents, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export const getDocument = (userId, id) => findOwnedOrThrow(userId, id);

export async function getDocumentStatus(userId, id) {
  const doc = await findOwnedOrThrow(userId, id, 'status processing');
  const { stage, progress = 0, lastError } = doc.processing ?? {};
  return {
    id: doc.id,
    status: doc.status,
    stage: stage ?? null,
    progress,
    error: lastError?.code ? { code: lastError.code, message: lastError.message } : null,
  };
}

export async function getDocumentFile(userId, id) {
  const doc = await findOwnedOrThrow(userId, id, 'storageKey originalName');
  const { stream, size } = await storage.openReadStream(doc.storageKey);
  return { stream, size, filename: doc.originalName };
}

export async function updateDocument(userId, id, changes) {
  const doc = await findOwnedOrThrow(userId, id);
  doc.set(changes);
  await doc.save();
  return doc;
}

export async function reprocessDocument(userId, id) {
  // Atomic: only settled documents can be requeued, so no job runs twice.
  const doc = await StudyDocument.findOneAndUpdate(
    { _id: id, userId, status: { $in: ['ready', 'failed'] } },
    {
      $set: {
        status: 'queued',
        'processing.attempts': 0,
        'processing.progress': 0,
        'processing.availableAt': new Date(),
      },
      $unset: { 'processing.lastError': 1, 'processing.stage': 1, 'processing.finishedAt': 1 },
    },
    { new: true },
  );
  if (doc) return doc;
  await findOwnedOrThrow(userId, id, '_id'); // 404 if it isn't theirs
  throw new AppError('ALREADY_PROCESSING');
}

export async function listChunks(userId, id, { page, limit }) {
  const doc = await findOwnedOrThrow(userId, id, 'status chunkGeneration');
  if (doc.status !== 'ready') throw new AppError('DOCUMENT_NOT_READY');

  const filter = { documentId: doc._id, generation: doc.chunkGeneration }; // active generation only
  const [chunks, total] = await Promise.all([
    Chunk.find(filter)
      .sort({ index: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Chunk.countDocuments(filter),
  ]);
  return { chunks, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function deleteDocument(userId, id) {
  const doc = await findOwnedOrThrow(userId, id, 'storageKey');
  await StudyDocument.deleteOne({ _id: doc._id, userId });
  await Promise.all([
    Chunk.deleteMany({ documentId: doc._id }),
    StudyArtifact.deleteMany({ documentId: doc._id }),
    // Conversations keep their history; they just can't search this document anymore.
    Conversation.updateMany({ userId, documentIds: doc._id }, { $pull: { documentIds: doc._id } }),
  ]);
  // DB first, then file: a leftover file is harmless, but a record pointing at a missing file is a broken doc.
  await storage
    .remove(doc.storageKey)
    .catch((err) => logger.warn({ err, key: doc.storageKey }, 'Orphaned file left in storage'));
}
