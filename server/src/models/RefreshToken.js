import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true }, // SHA-256 of the raw token; raw never stored
    familyId: { type: String, required: true, index: true }, // all rotations of one login share this
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: null, set: (v) => v?.slice(0, 512) },
    ip: { type: String, default: null, set: (v) => v?.slice(0, 64) },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index: MongoDB deletes the doc after expiresAt. The monitor runs ~every 60s,
// so expired docs can linger briefly — code must still check expiry (see isActive).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.methods.isActive = function (now = new Date()) {
  return !this.revokedAt && this.expiresAt > now;
};

refreshTokenSchema.plugin(toJSON, { hide: ['tokenHash', 'replacedByHash'] });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
