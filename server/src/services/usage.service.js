import mongoose from 'mongoose';
import { AiUsage, User } from '../models/index.js';
import { DEFAULT_DAILY_TOKEN_LIMIT } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 24 * HOUR_MS;
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

async function usedInWindow(userId, since) {
  const [row] = await AiUsage.aggregate([
    { $match: { userId, createdAt: { $gte: since } } },
    { $group: { _id: null, tokens: { $sum: '$quotaTokens' } } },
  ]);
  return row?.tokens ?? 0;
}

/**
 * Rolling 24h window instead of "resets at midnight": no timezone question, and no burst the moment
 * the day flips. It's a soft limit: two concurrent calls can both pass. A hard limit would need
 * atomic reservations; overshooting by one call is acceptable here.
 */
export async function assertWithinQuota(userId, reserveTokens = 0) {
  const uid = toObjectId(userId);
  const [user, used] = await Promise.all([
    User.findById(uid, 'limits').lean(),
    usedInWindow(uid, new Date(Date.now() - WINDOW_MS)),
  ]);
  if (!user) throw new AppError('UNAUTHORIZED');
  const limit = user.limits?.dailyTokens ?? DEFAULT_DAILY_TOKEN_LIMIT;
  if (used >= limit || used + reserveTokens > limit) {
    throw new AppError('QUOTA_EXCEEDED', { details: { used, limit } });
  }
  return { used, limit };
}

export async function getUsageSummary(userId, { days }) {
  const uid = toObjectId(userId);
  const since24h = new Date(Date.now() - WINDOW_MS);
  const sinceDays = new Date(Date.now() - days * 24 * HOUR_MS);

  const [user, used, byFeature, daily] = await Promise.all([
    User.findById(uid, 'limits').lean(),
    usedInWindow(uid, since24h),
    AiUsage.aggregate([
      { $match: { userId: uid, createdAt: { $gte: since24h } } },
      { $group: { _id: '$feature', tokens: { $sum: '$quotaTokens' }, calls: { $sum: 1 } } },
      { $sort: { tokens: -1 } },
    ]),
    AiUsage.aggregate([
      { $match: { userId: uid, createdAt: { $gte: sinceDays } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          tokens: { $sum: '$quotaTokens' },
          calls: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const limit = user?.limits?.dailyTokens ?? DEFAULT_DAILY_TOKEN_LIMIT;
  return {
    window: '24h',
    used,
    limit,
    remaining: Math.max(0, limit - used),
    byFeature: byFeature.map((f) => ({ feature: f._id, tokens: f.tokens, calls: f.calls })),
    daily: daily.map((d) => ({ date: d._id, tokens: d.tokens, calls: d.calls })),
  };
}
