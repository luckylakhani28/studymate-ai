# Deployment

## Shape

- **One Docker image**, two processes: the API (default command; it also serves the built React app) and the worker (`node src/worker.js`).
- **Single origin:** the browser talks to one domain, so the refresh cookie stays `SameSite=Strict`, CORS is unused, and SSE streams are not buffered by an intermediate proxy.
- **MongoDB Atlas** holds everything: data, the vector index, and (with `STORAGE_DRIVER=gridfs`) the uploaded PDFs, because most hosts have ephemeral disks.
- The embedding model and OCR language data are **baked into the image** at build time, so containers start ready.

## Memory

| Process                                        | Typical needs                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| API                                            | ~300–450 MB (Node + embedding model for query embeddings)                   |
| Worker                                         | ~600 MB–1 GB while OCR-ing (Tesseract + pdf.js rendering + embedding model) |
| Single-service mode (`RUN_WORKER_IN_API=true`) | ~1 GB; shares one embedding model between both roles                        |

Free tiers with 512 MB will struggle with OCR. For a demo on one small instance, use single-service mode with `OCR_MAX_PAGES` lowered.

## Steps (Render example)

1. **Atlas:** create a database user, allow network access for your host (often `0.0.0.0/0` with a strong password), and copy the connection string with a database name.
2. **Indexes, once per schema change:** from your machine with production env vars, run `npm run db:sync-indexes -w server`. This also creates the Atlas vector index.
3. **Render Blueprint:** push the repo, create a Blueprint from `render.yaml`, and fill in `MONGODB_URI`, `ANTHROPIC_API_KEY`, and `CLIENT_ORIGIN` (your service URL). Check the field names against Render's current Blueprint documentation.
4. **Verify:** `/api/health` returns `ok`; register, upload a PDF, and watch it reach Ready (the worker logs "Job completed").
5. **Optional:** `npm run seed:demo -w server` against production for a demo account.

Any container host works the same way (Railway, Fly.io, a VM with Docker): run the image twice with the same env vars, the second time with the worker command.

## Production checklist

- [ ] `NODE_ENV=production` (secure cookies, trust proxy, no auto-indexing)
- [ ] `JWT_ACCESS_SECRET` is random and ≥ 32 characters
- [ ] `STORAGE_DRIVER=gridfs` unless the host has a persistent disk
- [ ] `QA_MIN_SCORE` tuned with `eval:retrieval` on real notes
- [ ] Smart-tier prices (`AI_PRICE_SMART_*`) set from the official pricing page
- [ ] A monthly spend limit set in the Anthropic Console
- [ ] Atlas backups enabled (paid tiers) or a periodic `mongodump`
- [ ] Uptime monitor on `/api/health`

## Local production rehearsal

```bash
docker build -t studymate-ai .
docker run --env-file server/.env -e NODE_ENV=production -e STORAGE_DRIVER=gridfs -p 5050:5050 studymate-ai
docker run --env-file server/.env -e NODE_ENV=production -e STORAGE_DRIVER=gridfs studymate-ai node src/worker.js
```

Open http://localhost:5050. (Production cookies are `Secure`; browsers accept them on `localhost`.)
