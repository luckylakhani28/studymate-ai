import { env } from '../config/env.js';

const ratesFor = (model) =>
  model === env.AI_MODEL_FAST
    ? { input: env.AI_PRICE_FAST_INPUT, output: env.AI_PRICE_FAST_OUTPUT }
    : { input: env.AI_PRICE_SMART_INPUT, output: env.AI_PRICE_SMART_OUTPUT };

// Prompt caching: cache reads bill at 10% of the input rate, cache writes at 125%.
export function costUsd(model, u) {
  const r = ratesFor(model);
  return (
    (u.inputTokens * r.input +
      u.outputTokens * r.output +
      u.cacheReadTokens * r.input * 0.1 +
      u.cacheWriteTokens * r.input * 1.25) /
    1e6
  );
}

/** What a call counts against the user's quota: cost-weighted, so caching is rewarded, not penalized. */
export const quotaTokens = (u) =>
  Math.round(u.inputTokens + u.outputTokens + u.cacheReadTokens * 0.1 + u.cacheWriteTokens * 1.25);
