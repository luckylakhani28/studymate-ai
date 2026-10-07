/** The full stack in "test" mode: fake LLM, hash embeddings, exact vector search. Only MongoDB is external. */
export const SERVER_ENV = {
  NODE_ENV: 'test',
  PORT: '5050',
  MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/studymate-e2e',
  JWT_ACCESS_SECRET: 'e2e-secret-that-is-at-least-32-characters-long',
  CLIENT_ORIGIN: 'http://localhost:5173',
  AI_PROVIDER: 'fake',
  EMBEDDING_PROVIDER: 'hash',
  VECTOR_SEARCH_MODE: 'exact',
  STORAGE_DIR: './.e2e-storage',
  WORKER_POLL_MS: '200',
};
