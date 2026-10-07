import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, maxlength: 120, default: 'New conversation' },
    documentIds: {
      type: [{ type: ObjectId, ref: 'Document' }],
      validate: { validator: (v) => v.length <= 10, message: 'At most 10 documents' },
    },
    rollingSummary: { type: String, default: '' }, // older turns, compressed
    summarizedCount: { type: Number, default: 0 }, // how many messages the summary covers
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, lastMessageAt: -1 });

conversationSchema.statics.findOwned = function (id, userId, projection) {
  return this.findOne({ _id: id, userId }, projection);
};

conversationSchema.plugin(toJSON, { hide: ['rollingSummary', 'summarizedCount'] });

export const Conversation = mongoose.model('Conversation', conversationSchema);
