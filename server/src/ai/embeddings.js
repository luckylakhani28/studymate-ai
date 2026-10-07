import { env } from '../config/env.js';

export const EMBEDDING_DIMENSIONS = 384;

// bge-small-en-v1.5 is trained to embed short queries with this instruction prefix;
// passages are embedded without it. Asymmetric prefixes measurably improve retrieval.
const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

const normalize = (vec) => {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm ? vec.map((v) => v / norm) : vec;
};

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'was',
  'that',
  'this',
  'with',
  'from',
  'what',
  'how',
  'why',
  'does',
]);

/** Test double: hashed bag of words. Deterministic and instant, but has no notion of meaning. */
function hashEmbed(text) {
  const vec = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/\p{L}[\p{L}\p{N}]*/gu) ?? []) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    let h = 2166136261; // FNV-1a
    for (const ch of word) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    vec[(h >>> 0) % EMBEDDING_DIMENSIONS] += 1;
  }
  return normalize(vec);
}

const PROVIDERS = {
  local: () => {
    let extractorPromise = null;
    const load = async () => {
      // Imported lazily, so tests and hash mode never load onnxruntime.
      const { pipeline, env: hf } = await import('@huggingface/transformers');
      hf.cacheDir = env.EMBEDDING_CACHE_DIR;
      return pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' });
    };
    return {
      id: 'bge-small-en-v1.5:q8',
      queryPrefix: BGE_QUERY_PREFIX,
      async embed(texts) {
        extractorPromise ??= load().catch((err) => {
          extractorPromise = null; // a failed download must not poison later calls
          throw err;
        });
        const extractor = await extractorPromise;
        const output = await extractor(texts, { pooling: 'cls', normalize: true }); // BGE uses CLS pooling
        return output.tolist();
      },
    };
  },
  hash: () => ({
    id: 'hash-384:v1',
    queryPrefix: '',
    embed: async (texts) => texts.map(hashEmbed),
  }),
};

export function createEmbeddingProvider(name) {
  const factory = PROVIDERS[name];
  if (!factory) throw new Error(`Unknown embedding provider: ${name}`);
  return factory();
}

const defaultProvider = createEmbeddingProvider(env.EMBEDDING_PROVIDER);

/** Stored on every document. Vectors from different models must never be compared. */
export const EMBEDDING_MODEL_ID = defaultProvider.id;

export async function embedDocuments(
  texts,
  { signal, onProgress, batchSize = 16, using = defaultProvider } = {},
) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    signal?.throwIfAborted();
    vectors.push(...(await using.embed(texts.slice(i, i + batchSize))));
    onProgress?.(Math.min(1, (i + batchSize) / texts.length));
  }
  return vectors;
}

export async function embedQuery(text, { using = defaultProvider } = {}) {
  const [vector] = await using.embed([using.queryPrefix + text]);
  return vector;
}

export const warmUpEmbeddings = () => embedQuery('warm up');
