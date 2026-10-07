import * as usageService from '../services/usage.service.js';
import { ok } from '../utils/apiResponse.js';

export async function me(req, res) {
  ok(res, await usageService.getUsageSummary(req.user.id, req.validated.query));
}
