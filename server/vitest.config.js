import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 120_000, // first run downloads the MongoDB binary (and OCR language data)
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/studymate-test', // satisfies the env schema; tests use an in-memory server
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      JWT_ACCESS_SECRET_PREVIOUS: 'previous-test-secret-that-is-at-least-32-chars',
      BCRYPT_ROUNDS: '4', // fast hashing in tests only
      STORAGE_DIR: mkdtempSync(path.join(tmpdir(), 'studymate-test-')),
      MAX_UPLOAD_MB: '1',
      OCR_MAX_PAGES: '1',
      EMBEDDING_PROVIDER: 'hash', // deterministic, no model download
      VECTOR_SEARCH_MODE: 'exact', // mongodb-memory-server has no $vectorSearch
      AI_PROVIDER: 'fake', // tests never call the real API
      QA_MIN_SCORE: '0.55', // the hash embedder scores unrelated text at ~0.5
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/scripts/**', 'src/server.js', 'src/worker.js'],
      reporter: ['text-summary', 'html', 'lcov'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  },
});
