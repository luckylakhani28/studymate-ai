import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

const citationSchema = new mongoose.Schema(
  {
    label: String, // "S1"
    chunkId: ObjectId,
    documentId: ObjectId,
    documentTitle: String,
    pageStart: Number,
    pageEnd: Number,
    sectionTitle: String,
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: ObjectId, ref: 'Conversation', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '', maxlength: 20_000 },
    citations: { type: [citationSchema], default: undefined },
    grounded: Boolean, // false: answered "not in your notes" without calling the model
    status: { type: String, enum: ['complete', 'stopped', 'error'], default: 'complete' },
    errorCode: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Separate collection, not an array inside Conversation: chats grow without bound (16 MB limit).
messageSchema.index({ conversationId: 1, _id: -1 }); // newest-first pages with an _id cursor

messageSchema.plugin(toJSON);

export const Message = mongoose.model('Message', messageSchema);
