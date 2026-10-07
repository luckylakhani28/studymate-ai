import { env } from '../config/env.js';
import { Chunk, StudyDocument } from '../models/index.js';
import { getPrompt } from './prompts/registry.js';
import { llm } from './llm.js';

/** Consecutive chunks → groups under a token budget, so each map call sees a coherent stretch of text. */
export function groupChunks(chunks, maxTokens) {
  const groups = [];
  let current = [];
  let tokens = 0;
  for (const chunk of chunks) {
    if (current.length && tokens + chunk.tokenCount > maxTokens) {
      groups.push(current);
      current = [];
      tokens = 0;
    }
    current.push(chunk);
    tokens += chunk.tokenCount;
  }
  if (current.length) groups.push(current);
  return groups;
}

/** Cited ids (["S2","S1"]) + the passages they name → sorted, unique page numbers. */
export function pagesFor(sourceIds, passages, max = 20) {
  const pages = new Set();
  for (const id of sourceIds) {
    const p = passages[Number(id.slice(1)) - 1];
    if (!p) continue;
    for (let n = p.pageStart; n <= p.pageEnd && pages.size < max; n += 1) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * Map step: computed once per document version and reused by every study tool, so the model reads
 * a long PDF once rather than once per tool. Keyed by contentHash + prompt version.
 */
export async function ensureDigest(doc, { signal, onProgress } = {}) {
  const version = getPrompt('section_summary').version;
  if (doc.digest?.contentHash === doc.contentHash && doc.digest?.promptVersion === version)
    return doc.digest;

  const chunks = await Chunk.find({ documentId: doc._id, generation: doc.chunkGeneration })
    .sort({ index: 1 })
    .lean();
  const groups = groupChunks(chunks, env.DIGEST_GROUP_TOKENS);
  const sections = [];

  for (const [i, group] of groups.entries()) {
    signal?.throwIfAborted();
    const { data } = await llm.runPrompt(
      'section_summary',
      { documentTitle: doc.title, passages: group },
      { userId: doc.userId, feature: 'digest', signal },
    );
    sections.push({
      title: group.find((c) => c.sectionTitle)?.sectionTitle,
      pageStart: group[0].pageStart,
      pageEnd: Math.max(...group.map((c) => c.pageEnd)),
      summary: data.summary,
      keyPoints: data.keyPoints.map((k) => ({ point: k.point, pages: pagesFor(k.sources, group) })),
    });
    onProgress?.((i + 1) / groups.length);
  }

  const digest = { contentHash: doc.contentHash, promptVersion: version, sections };
  // Guarded: if the document was reprocessed meanwhile, this digest is already stale, so don't store it.
  await StudyDocument.updateOne(
    { _id: doc._id, contentHash: doc.contentHash },
    { $set: { digest } },
  );
  return digest;
}

/** Digest sections as citable passages (S1..Sn) for the reduce prompts. */
export const digestPassages = (digest) =>
  digest.sections.map((s) => ({
    pageStart: s.pageStart,
    pageEnd: s.pageEnd,
    sectionTitle: s.title,
    text: `${s.summary}\n${s.keyPoints.map((k) => `- ${k.point}`).join('\n')}`,
  }));
