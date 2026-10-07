// Usage: npm run usage:report -w server -- [days=7]
// Where is the money going? Cost, tokens, cache hits, and latency per feature and model.
import { connectDB, disconnectDB } from '../config/db.js';
import { AiUsage } from '../models/index.js';

const days = Number(process.argv[2] ?? 7);
await connectDB();

const rows = await AiUsage.aggregate([
  { $match: { createdAt: { $gte: new Date(Date.now() - days * 86_400_000) } } },
  {
    $group: {
      _id: { feature: '$feature', model: '$model' },
      calls: { $sum: 1 },
      errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
      avgIn: { $avg: '$inputTokens' },
      avgOut: { $avg: '$outputTokens' },
      inputTotal: { $sum: '$inputTokens' },
      cacheRead: { $sum: '$cacheReadTokens' },
      cost: { $sum: '$costUsd' },
      latency: { $percentile: { input: '$latencyMs', p: [0.5, 0.95], method: 'approximate' } },
    },
  },
  { $sort: { cost: -1 } },
]);

console.log(`AI usage, last ${days} days\n`);
console.table(
  rows.map((r) => ({
    feature: r._id.feature,
    model: r._id.model,
    calls: r.calls,
    errors: r.errors,
    'avg in': Math.round(r.avgIn),
    'avg out': Math.round(r.avgOut),
    'cache hit %':
      r.cacheRead + r.inputTotal
        ? Math.round((100 * r.cacheRead) / (r.cacheRead + r.inputTotal))
        : 0,
    'cost $': r.cost.toFixed(4),
    'p50 ms': Math.round(r.latency?.[0] ?? 0),
    'p95 ms': Math.round(r.latency?.[1] ?? 0),
  })),
);
await disconnectDB();
