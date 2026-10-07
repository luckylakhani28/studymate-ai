import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

const chunkSchema = new mongoose.Schema(
  {
    documentId: { type: ObjectId, ref: 'Document', required: true },
    userId: { type: ObjectId, ref: 'User', required: true }, // denormalized: every query is user-scoped
    generation: { type: String, required: true }, // which processing run produced this chunk
    index: { type: Number, required: true, min: 0 },
    text: { type: String, required: true },
    tokenCount: { type: Number, required: true, min: 0 },
    pageStart: { type: Number, required: true, min: 1 },
    pageEnd: { type: Number, required: true, min: 1 },
    sectionTitle: String,
    source: { type: String, enum: ['text', 'ocr', 'mixed'], default: 'text' },
    lowConfidence: { type: Boolean, default: false }, // spans an OCR page that was hard to read
    embedding: { type: [Number], select: false }, // 384 floats; only loaded when explicitly selected
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chunkSchema.index({ documentId: 1, generation: 1, index: 1 }, { unique: true });
// Keyword search, always scoped: the userId prefix means a query can't search across users.
chunkSchema.index(
  { userId: 1, text: 'text', sectionTitle: 'text' },
  { name: 'chunk_text_search', weights: { sectionTitle: 3, text: 1 } },
);

chunkSchema.plugin(toJSON, { hide: ['generation', 'embedding'] });

export const Chunk = mongoose.model('Chunk', chunkSchema);
