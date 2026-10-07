import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    feature: { type: String, required: true }, // what the user was doing, e.g. "summary", "qa"
    promptId: String,
    promptVersion: Number,
    model: String,
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },
    quotaTokens: { type: Number, default: 0 }, // cost-weighted count charged against the user's limit
    costUsd: { type: Number, default: 0 },
    latencyMs: Number,
    status: { type: String, enum: ['ok', 'error'], required: true },
    errorCode: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiUsageSchema.index({ userId: 1, createdAt: -1 }); // quota window and usage reports
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // keep 90 days

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);
