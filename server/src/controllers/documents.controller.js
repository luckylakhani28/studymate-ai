import { pipeline } from 'node:stream/promises';
import * as documentsService from '../services/documents.service.js';
import { ok, noContent } from '../utils/apiResponse.js';

export async function upload(req, res) {
  const document = await documentsService.uploadDocument(req.user.id, req.file);
  ok(res, { document }, { status: 202 }); // accepted: processing happens asynchronously
}

export async function list(req, res) {
  const { documents, meta } = await documentsService.listDocuments(
    req.user.id,
    req.validated.query,
  );
  ok(res, { documents }, { meta });
}

export async function get(req, res) {
  ok(res, { document: await documentsService.getDocument(req.user.id, req.validated.params.id) });
}

export async function status(req, res) {
  ok(res, await documentsService.getDocumentStatus(req.user.id, req.validated.params.id));
}

export async function file(req, res) {
  const { stream, size, filename } = await documentsService.getDocumentFile(
    req.user.id,
    req.validated.params.id,
  );
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': size,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox", // a PDF opened directly can't run scripts
  });
  try {
    await pipeline(stream, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err; // the client closed the tab mid-download
  }
}

export async function update(req, res) {
  const { params, body } = req.validated;
  ok(res, { document: await documentsService.updateDocument(req.user.id, params.id, body) });
}

export async function reprocess(req, res) {
  const document = await documentsService.reprocessDocument(req.user.id, req.validated.params.id);
  ok(res, { document }, { status: 202 });
}

export async function chunks(req, res) {
  const { params, query } = req.validated;
  const { chunks: items, meta } = await documentsService.listChunks(req.user.id, params.id, query);
  ok(res, { chunks: items }, { meta });
}

export async function remove(req, res) {
  await documentsService.deleteDocument(req.user.id, req.validated.params.id);
  noContent(res);
}
