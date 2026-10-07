# Interview Notes

## 30-second pitch

StudyMate turns lecture PDFs, including scanned ones, into a tutor that answers with page citations. Uploads are processed by a background worker: pdf.js extraction with per-page quality scoring, OCR only where the text layer is broken, cleaning, chunking, and local embeddings. Questions go through hybrid retrieval with a relevance gate, so off-topic questions get "not in your notes" at zero token cost, and answers stream over SSE with citations that open the exact page.

## Resume bullets (match what you built)

- Built a full-stack AI study assistant (React, Node.js/Express, MongoDB Atlas, Claude API) that answers questions over uploaded PDFs with page-level citations, streaming responses, and a relevance gate that declines off-topic questions without an LLM call.
- Designed a document pipeline with per-page quality scoring and targeted OCR (pdf.js + Tesseract), section-aware chunking, and local embeddings, running on a MongoDB-backed job queue with atomic claims, heartbeats, retries with backoff, and crash recovery.
- Implemented hybrid retrieval (Atlas Vector Search + keyword search fused with RRF) and evaluated it with hit@k / MRR on a hand-labelled question set _(add your numbers)_.
- Generated summaries, notes, quizzes and flashcards via map-reduce over a cached document digest, with zod-validated structured outputs, versioned prompts, per-user token quotas, and usage metering.
- Hardened the system: refresh-token rotation with reuse detection, an authorization test matrix over every route, prompt-injection red-team evals, and CI with unit, integration, and Playwright end-to-end tests.

**About metrics:** only claim numbers you measured. For a "time saved" metric, run a small study: give 3–5 classmates the same PDF and 10 questions; time them answering with the PDF alone vs. with StudyMate, and check answers for correctness. Report it as "in a small informal test with N students…".

## Questions you should be ready for

**Why not send the whole PDF to the model?** Cost scales with input tokens, long contexts dilute attention, and you can't cite precisely. Retrieval sends ~3k tokens of the most relevant passages; the eval shows the right passage is usually in them.

**How do you stop hallucinations?** Grounding rules; a relevance gate that skips the LLM when nothing relevant is retrieved; citations validated against the sources actually sent (invented ids trigger a repair turn); low-confidence OCR flagged.

**Why MongoDB as a queue?** One less service. `findOneAndUpdate` gives an atomic claim; heartbeats keep locks fresh; stale locks are reclaimed; an attempt cap stops poison jobs. At-least-once processing, made safe by idempotent writes and chunk generations.

**What happens if the worker crashes mid-job?** The lock expires (60s), another worker reclaims it, the attempt counter increments; after three attempts it fails permanently with a visible reason. Chunks written by the crashed attempt are cleaned up by the next successful run.

**How does hybrid search work, and why RRF?** Vector search catches paraphrases; keyword search catches exact terms. Their scores are on different scales, so RRF fuses ranks: Σ 1/(60 + rank).

**How do you handle prompt injection?** Defense in depth, and containment: the model has no tools that act, so the worst case is one bad answer, which shows its citations.

**What would you change at 100× scale?** BullMQ/Redis queue and rate-limit store, an embeddings service shared by workers, float32/int8 vectors (BinData), object storage for PDFs, horizontal API scaling behind a load balancer, and per-tenant observability.

**A bug you found and fixed:** the multi-tab refresh race. Two tabs refreshed simultaneously; the loser's error response cleared the cookie the winner had just received. Fix: a distinct `REFRESH_RACE` code that doesn't clear the cookie, plus a client retry.

**A trade-off you'd revisit:** stateless JWTs give no instant revocation (≤ 15 min); a token denylist or short-lived sessions in Redis would close that.

## Numbers to have ready (fill in)

- Retrieval: hybrid hit@6 ___ , MRR ___ (N = ___ questions)
- Q&A: cites the right page ___ %, refuses off-topic ___ %, median latency ___ ms, cost per question $___
- Processing: ___ s for a ___-page typed PDF; OCR ___ s/page at 200 DPI, ___ % average confidence
- Tests: 137 server, 4 client, 1 end-to-end; CI on every push
