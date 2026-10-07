# syntax=docker/dockerfile:1
# One image runs both processes: the API (default CMD) and the worker (override the command).
# Debian-based on purpose: onnxruntime and @napi-rs/canvas ship glibc binaries.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

FROM deps AS client-build
COPY client ./client
RUN npm run build -w client

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    SERVE_CLIENT_DIR=/app/client/dist \
    STORAGE_DIR=/app/server/storage \
    EMBEDDING_CACHE_DIR=/app/server/.model-cache \
    OCR_CACHE_DIR=/app/server/.ocr-cache \
    PORT=5050
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server && npm cache clean --force

COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist
RUN mkdir -p server/storage && chown -R node:node /app/server
USER node

# Bake the embedding model and OCR language data into the image: containers start ready.
WORKDIR /app/server
RUN node src/scripts/prefetchModels.js

EXPOSE 5050
CMD ["node", "--max-old-space-size=768", "src/server.js"]
