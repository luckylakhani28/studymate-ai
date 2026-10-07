import { retrieveChunks } from '../ai/retrieval.js';
import { ok } from '../utils/apiResponse.js';

export async function search(req, res) {
  const { query, documentIds, limit, mode } = req.validated.body;
  ok(res, await retrieveChunks({ userId: req.user.id, documentIds, query, limit, mode }));
}
