import mongoose from 'mongoose';
import { toJSON } from './plugins/toJSON.js';

export const USER_ROLES = Object.freeze(['user', 'admin']);
export const DEFAULT_DAILY_TOKEN_LIMIT = 500_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, 'Invalid email'],
    },
    // Hashed in the auth service, not a pre-save hook: hooks cause double-hashing bugs on re-save.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    limits: {
      dailyTokens: { type: Number, min: 0, default: DEFAULT_DAILY_TOKEN_LIMIT },
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.plugin(toJSON, { hide: ['passwordHash'] });

export const User = mongoose.model('User', userSchema);
