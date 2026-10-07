import { assertWithinQuota } from '../services/usage.service.js';

/**
 * Early rejection for AI routes, before any retrieval or embedding work.
 * The LLM layer checks again with the real token reservation.
 */
export async function requireQuota(req, _res, next) {
  await assertWithinQuota(req.user.id);
  next();
}
