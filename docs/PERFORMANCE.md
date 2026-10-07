# Performance & Cost: Measurements

Fill these in from your own runs. Method: `npm run eval:retrieval`, `npm run eval:qa`, `npm run usage:report`, `npm run build -w client`. Never copy numbers you didn't measure.

## Retrieval (eval:retrieval, <document>, <N> questions)

| Mode    | hit@1 | hit@3 | hit@6 | MRR |
| ------- | ----- | ----- | ----- | --- |
| keyword |       |       |       |     |
| vector  |       |       |       |     |
| hybrid  |       |       |       |     |

Relevance gate: lowest top score for answerable questions ___, highest for unanswerable ___ → `QA_MIN_SCORE` = ___

## Q&A configuration (eval:qa)

| Context budget | Model | Cites right page | Refuses off-topic | Median input tokens | Cost | Median latency |
| -------------- | ----- | ---------------- | ----------------- | ------------------- | ---- | -------------- |
| 3000 (before)  | smart |                  |                   |                     |      |                |
| 1500           | smart |                  |                   |                     |      |                |
| 1500           | fast  |                  |                   |                     |      |                |

**Decision:** …

## Processing

| PDF | Pages | Typed / scanned | Processing time | OCR time per page | Avg OCR confidence |
| --- | ----- | --------------- | --------------- | ----------------- | ------------------ |

## Cost by feature (usage:report, 7 days)

| Feature | Calls | Avg in | Avg out | Cache hit % | Cost | p95 latency |
| ------- | ----- | ------ | ------- | ----------- | ---- | ----------- |

## Design savings (vs. naive "send the PDF")

- Relevance gate: off-topic questions cost 0 tokens.
- Artifact cache: repeat requests cost 0 tokens.
- Digest reuse: N study tools on one document = 1 map pass + N reduce calls instead of N full reads.

## Client bundle (gzip)

|                       | Initial JS                                                       |
| --------------------- | ---------------------------------------------------------------- |
| Before code splitting |                                                                  |
| After                 | ~138 kB (measured at release; chat page ~39 kB loaded on demand) |
