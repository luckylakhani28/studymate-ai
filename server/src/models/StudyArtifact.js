import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

export const ARTIFACT_TYPES = Object.freeze([
  'summary',
  'notes',
  'key_concepts',
  'quiz',
  'flashcards',
]);
const { ObjectId, Mixed } = mongoose.Schema.Types;

const artifactSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    documentId: { type: ObjectId, ref: 'Document', required: true },
    type: { type: String, enum: ARTIFACT_TYPES, required: true },
    options: { type: Mixed, default: {} }, // e.g. { count: 10, difficulty: 'mixed' } for quizzes
    cacheKey: { type: String, required: true },
    promptVersion: { type: Number, required: true },
    status: { type: String, enum: ['queued', 'processing', 'ready', 'failed'], default: 'queued' },
    content: Mixed, // shape depends on type; validated by the prompt's zod schema before saving
    processing: {
      stage: String,
      progress: { type: Number, default: 0 },
      attempts: { type: Number, default: 0 },
      lockedBy: String,
      lockedAt: Date,
      startedAt: Date,
      finishedAt: Date,
      availableAt: Date,
      lastError: { code: String, message: String, at: Date },
    },
  },
  { timestamps: true },
);

artifactSchema.index({ userId: 1, cacheKey: 1 }, { unique: true }); // the cache, enforced by the database
artifactSchema.index({ documentId: 1, type: 1, createdAt: -1 });
artifactSchema.index({ status: 1, 'processing.lockedAt': 1 }); // job claiming

artifactSchema.statics.findOwned = function (id, userId, projection) {
  return this.findOne({ _id: id, userId }, projection);
};

artifactSchema.plugin(toJSON, { hide: ['cacheKey', 'processing.lockedBy', 'processing.lockedAt'] });

export const StudyArtifact = mongoose.model('StudyArtifact', artifactSchema);
