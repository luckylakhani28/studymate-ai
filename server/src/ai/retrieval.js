import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Chunk, StudyDocument } from '../models/index.js';
import { EMBEDDING_MODEL_ID, embedQuery } from './embeddings.js';
import { reciprocalRankFusion } from './rankFusion.js';

const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

/** Atlas approximate nearest neighbours. Aggregations skip Mongoose casting, so userId must be an ObjectId. */
function vectorSearchAtlas({ userId, generations, queryVector, limit }) {
  return Chunk.aggregate([
    {
      $vectorSearch: {
        index: env.VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector,
        numCandidates: Math.max(100, limit * 15), // ANN accuracy knob: more candidates = better recall, slower
        limit,
        filter: { userId: { $eq: userId }, generation: { $in: generations } },
      },
    },
    { $project: { _id: 1, score: { $meta: 'vectorSearchScore' } } },
  ]);
}

/** Exact cosine in Node: tests, local MongoDB, and the correctness baseline for the ANN index. */
async function vectorSearchExact({ userId, generations, queryVector, limit }) {
  const candidates = await Chunk.find({ userId, generation: { $in: generations } })
    .select('embedding')
    .lean();
  return candidates
    .filter((c) => c.embedding?.length)
    .map((c) => ({ _id: c._id, score: (1 + dot(c.embedding, queryVector)) / 2 })) // same 0..1 scale as Atlas
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** MongoDB $text treats "quotes" and -minus as operators; a student's question must be plain words. */
const toPlainTerms = (query) => query.replace(/["-]/g, ' ');

function keywordSearch({ userId, generations, query, limit }) {
  return Chunk.find(
    { userId, generation: { $in: generations }, $text: { $search: toPlainTerms(query) } },
    { score: { $meta: 'textScore' } },
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
}

/**
 * Finds the passages most relevant to `query` across a user's ready documents.
 * Returns ranked results plus the ids of documents that need reprocessing for the current model.
 */
export async function retrieveChunks({ userId, documentIds, query, limit = 6, mode = 'hybrid' }) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const docs = await StudyDocument.find(
    { userId: uid, status: 'ready', ...(documentIds?.length && { _id: { $in: documentIds } }) },
    'title chunkGeneration embeddingModel',
  ).lean();

  const usable = docs.filter((d) => d.chunkGeneration && d.embeddingModel === EMBEDDING_MODEL_ID);
  const staleDocumentIds = docs.filter((d) => !usable.includes(d)).map((d) => String(d._id));
  if (usable.length === 0) return { results: [], staleDocumentIds };

  const generations = usable.map((d) => d.chunkGeneration);
  const pool = limit * 4; // each retriever proposes more than we keep; fusion picks the best
  const vectorSearch = env.VECTOR_SEARCH_MODE === 'atlas' ? vectorSearchAtlas : vectorSearchExact;

  const [vectorHits, keywordHits] = await Promise.all([
    mode === 'keyword'
      ? []
      : embedQuery(query).then((queryVector) =>
          vectorSearch({ userId: uid, generations, queryVector, limit: pool }),
        ),
    mode === 'vector' ? [] : keywordSearch({ userId: uid, generations, query, limit: pool }),
  ]);

  const fused = reciprocalRankFusion([
    vectorHits.map((h) => String(h._id)),
    keywordHits.map((h) => String(h._id)),
  ]).slice(0, limit);

  const chunks = await Chunk.find({ _id: { $in: fused.map((f) => f.id) } }).lean();
  const byId = new Map(chunks.map((c) => [String(c._id), c]));
  const vectorScores = new Map(vectorHits.map((h) => [String(h._id), h.score]));
  const titles = new Map(usable.map((d) => [String(d._id), d.title]));

  const results = fused
    .filter((f) => byId.has(f.id))
    .map(({ id, score }) => {
      const c = byId.get(id);
      return {
        chunkId: id,
        documentId: String(c.documentId),
        documentTitle: titles.get(String(c.documentId)),
        text: c.text,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        sectionTitle: c.sectionTitle,
        lowConfidence: c.lowConfidence,
        score, // RRF: ranking only
        vectorScore: vectorScores.get(id) ?? null, // cosine 0..1: the "is this even in the notes?" gate
      };
    });

  return { results, staleDocumentIds };
}
