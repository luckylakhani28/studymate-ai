import * as artifactsService from '../services/artifacts.service.js';
import { ok, noContent } from '../utils/apiResponse.js';

export async function create(req, res) {
  const { params, body } = req.validated;
  const { artifact, cached } = await artifactsService.requestArtifact(req.user.id, params.id, body);
  ok(res, { artifact, cached }, { status: cached ? 200 : 202 });
}

export async function list(req, res) {
  const { params, query } = req.validated;
  ok(res, { artifacts: await artifactsService.listArtifacts(req.user.id, params.id, query) });
}

export async function get(req, res) {
  ok(res, { artifact: await artifactsService.getArtifact(req.user.id, req.validated.params.id) });
}

export async function remove(req, res) {
  await artifactsService.deleteArtifact(req.user.id, req.validated.params.id);
  noContent(res);
}
