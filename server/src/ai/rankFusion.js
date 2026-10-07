/**
 * Reciprocal Rank Fusion: score(d) = Σ 1 / (k + rank).
 * Uses ranks, not raw scores, because cosine similarity and text scores are on incomparable scales.
 * k = 60 is the value from the original RRF paper.
 */
export function reciprocalRankFusion(rankings, k = 60) {
  const scores = new Map();
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...scores].sort((a, b) => b[1] - a[1]).map(([id, score]) => ({ id, score }));
}
