import path from 'node:path';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
const dir = (fallback) =>
  z
    .string()
    .min(1)
    .default(fallback)
    .transform((p) => path.resolve(p));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5050),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CLIENT_ORIGIN: z
      .string()
      .default('http://localhost:5173')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
    SERVE_CLIENT_DIR: z
      .string()
      .optional()
      .transform((p) => (p ? path.resolve(p) : undefined)),

    // Auth
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_ACCESS_SECRET_PREVIOUS: z.string().min(32).optional(),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'e.g. 15m, 1h')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),

    // Uploads and storage
    STORAGE_DRIVER: z.enum(['local', 'gridfs']).default('local'),
    STORAGE_DIR: dir('./storage'),
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(25),
    MAX_DOCUMENTS_PER_USER: z.coerce.number().int().min(1).default(100),

    // Worker
    WORKER_POLL_MS: z.coerce.number().int().min(100).default(2000),
    JOB_LOCK_TTL_MS: z.coerce.number().int().min(5000).default(60_000),
    JOB_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .default(10 * 60_000),
    JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    MAX_PDF_PAGES: z.coerce.number().int().min(1).default(300),
    RUN_WORKER_IN_API: bool,

    // OCR
    OCR_LANGS: z
      .string()
      .regex(/^[a-z_]+(\+[a-z_]+)*$/, 'e.g. eng or eng+hin')
      .default('eng'),
    OCR_DPI: z.coerce.number().int().min(72).max(400).default(200),
    OCR_MAX_PAGES: z.coerce.number().int().min(0).default(100),
    OCR_CACHE_DIR: dir('./.ocr-cache'),

    // Embeddings and retrieval
    EMBEDDING_PROVIDER: z.enum(['local', 'hash']).default('local'),
    EMBEDDING_CACHE_DIR: dir('./.model-cache'),
    VECTOR_SEARCH_MODE: z.enum(['atlas', 'exact']).default('atlas'),
    VECTOR_INDEX_NAME: z.string().min(1).default('chunk_vector_index'),

    // LLM
    AI_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL_FAST: z.string().min(1).default('claude-haiku-4-5-20251001'),
    AI_MODEL_SMART: z.string().min(1).default('claude-sonnet-5-5'),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    AI_PRICE_FAST_INPUT: z.coerce.number().min(0).default(1),
    AI_PRICE_FAST_OUTPUT: z.coerce.number().min(0).default(5),
    AI_PRICE_SMART_INPUT: z.coerce.number().min(0).default(3),
    AI_PRICE_SMART_OUTPUT: z.coerce.number().min(0).default(15),

    // Q&A and study tools
    QA_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.75),
    QA_CONTEXT_TOKENS: z.coerce.number().int().min(500).default(3000),
    DIGEST_GROUP_TOKENS: z.coerce.number().int().min(500).default(3000),
  })
  .superRefine((val, ctx) => {
    if (val.AI_PROVIDER === 'anthropic' && !val.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'required when AI_PROVIDER=anthropic',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
