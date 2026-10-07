import { StudyDocument } from '../../models/index.js';
import { llm } from '../../ai/llm.js';
import { digestPassages, ensureDigest } from '../../ai/digest.js';
import { ARTIFACT_SPECS } from '../../ai/artifactSpecs.js';
import { permanentError } from '../errors.js';
import { createProgressReporter } from '../progress.js';

export async function generateArtifact(artifact, { signal, progress }) {
  const doc = await StudyDocument.findById(artifact.documentId).select('+digest');
  if (doc?.status !== 'ready')
    throw permanentError('DOCUMENT_NOT_READY', 'This document isn’t available anymore.');

  const stage = createProgressReporter(progress);
  const digest = await ensureDigest(doc, { signal, onProgress: stage('mapping', 0, 80) });
  stage('writing', 80, 100)(0);

  const spec = ARTIFACT_SPECS[artifact.type];
  const passages = digestPassages(digest);
  // `version` pins the exact prompt the cache key was built from, even if `active` changes meanwhile.
  const { data } = await llm.runPrompt(
    spec.prompt,
    { documentTitle: doc.title, passages, ...artifact.options },
    { userId: artifact.userId, feature: artifact.type, signal, version: artifact.promptVersion },
  );
  return { content: spec.toContent(data, passages) };
}
