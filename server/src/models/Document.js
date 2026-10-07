import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

export const DOCUMENT_STATUS = Object.freeze(['queued', 'processing', 'ready', 'failed']);
export const PROCESSING_STAGES = Object.freeze(['extracting', 'ocr', 'chunking', 'embedding']);
export const EXTRACTION_METHODS = Object.freeze(['text', 'ocr', 'mixed']);
export const PAGE_QUALITY = Object.freeze(['text', 'blank', 'scanned', 'garbled', 'image-heavy']);
export const MAX_TAGS = 10;

const { ObjectId } = mongoose.Schema.Types;

const outlineItemSchema = new mongoose.Schema(
  { title: String, level: Number, page: Number },
  { _id: false },
);

const pageStatSchema = new mongoose.Schema(
  {
    page: Number,
    chars: Number,
    quality: { type: String, enum: PAGE_QUALITY },
    source: { type: String, enum: ['text', 'ocr'] }, // where this page's final text came from
    confidence: Number, // OCR pages only, 0–100
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
      validate: { validator: (v) => v.length <= MAX_TAGS, message: `At most ${MAX_TAGS} tags` },
    },

    // File facts (set at upload, never by the client)
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true, enum: ['application/pdf'] },
    sizeBytes: { type: Number, required: true, min: 1 },
    fileHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ }, // SHA-256 of bytes
    pageCount: { type: Number, min: 0 },
    contentHash: { type: String }, // hash of cleaned text; keys the study-tool cache
    chunkGeneration: String, // the active chunk set; swapped atomically on each completed run
    embeddingModel: String, // documents embedded by another model must be reprocessed
    digest: { type: mongoose.Schema.Types.Mixed, select: false }, // map-step output, reused by all study tools

    // Job state machine (worker-owned)
    status: { type: String, enum: DOCUMENT_STATUS, default: 'queued' },
    processing: {
      stage: { type: String, enum: PROCESSING_STAGES },
      progress: { type: Number, min: 0, max: 100, default: 0 },
      attempts: { type: Number, min: 0, default: 0 },
      lockedBy: String,
      lockedAt: Date,
      startedAt: Date,
      finishedAt: Date,
      availableAt: Date, // retry backoff: not claimable before this time
      lastError: { code: String, message: String, at: Date },
    },

    // Extraction results
    extraction: {
      method: { type: String, enum: EXTRACTION_METHODS },
      ocrPages: { type: [Number], default: undefined },
      lowConfidencePages: { type: [Number], default: undefined },
      ocrSkippedPages: { type: [Number], default: undefined }, // needed OCR but exceeded OCR_MAX_PAGES
      avgOcrConfidence: { type: Number, min: 0, max: 100 },
      pageStats: { type: [pageStatSchema], default: undefined },
    },
    stats: {
      chunkCount: { type: Number, default: 0 },
      tokenCount: { type: Number, default: 0 },
      charCount: { type: Number, default: 0 },
    },
    metadata: {
      title: String,
      author: String,
      language: String,
      outline: { type: [outlineItemSchema], default: undefined },
    },
  },
  { timestamps: true },
);

// Display title defaults to the filename without ".pdf"; the user can rename later.
documentSchema.pre('validate', function () {
  if (!this.title && this.originalName) this.title = this.originalName.replace(/\.pdf$/i, '');
});

documentSchema.index({ userId: 1, createdAt: -1 }); // library listing, newest first
documentSchema.index({ userId: 1, fileHash: 1 }, { unique: true }); // per-user duplicate detection
documentSchema.index({ status: 1, 'processing.lockedAt': 1 }); // worker job claiming

/** The ONLY way services should load a document: always scoped to its owner. */
documentSchema.statics.findOwned = function (id, userId, projection) {
  return this.findOne({ _id: id, userId }, projection);
};

documentSchema.plugin(toJSON, {
  hide: ['storageKey', 'chunkGeneration', 'digest', 'processing.lockedBy', 'processing.lockedAt'],
});

export const StudyDocument = mongoose.model('Document', documentSchema);
