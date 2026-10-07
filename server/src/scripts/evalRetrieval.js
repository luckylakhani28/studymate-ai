// Usage: npm run eval:retrieval -w server -- <documentId> /absolute/path/questions.json [k]
// Questions: [{ "question": "...", "pages": [14] }]; use "pages": [] for questions the PDF can't answer.
import { readFile } from 'node:fs/promises';
import { connectDB, disconnectDB } from '../config/db.js';
import { StudyDocument } from '../models/index.js';
import { retrieveChunks } from '../ai/retrieval.js';

const [documentId, file, kArg] = process.argv.slice(2);
if (!documentId || !file) {
  console.error(
    'Usage: npm run eval:retrieval -w server -- <documentId> /absolute/path/questions.json [k]',
  );
  process.exit(1);
}
const K = Number(kArg ?? 6);
const allQuestions = JSON.parse(await readFile(file, 'utf8'));
const answerable = allQuestions.filter((q) => q.pages.length > 0);
const unanswerable = allQuestions.filter((q) => q.pages.length === 0);
const pct = (n) => `${Math.round((n / answerable.length) * 100)}%`;
const covers = (result, pages) => pages.some((p) => p >= result.pageStart && p <= result.pageEnd);

await connectDB();
const doc = await StudyDocument.findById(documentId).lean();
if (!doc) throw new Error('Document not found');

const rows = [];
const misses = [];
for (const mode of ['keyword', 'vector', 'hybrid']) {
  let hit1 = 0;
  let hit3 = 0;
  let hitK = 0;
  let reciprocalRanks = 0;
  for (const q of answerable) {
    const { results } = await retrieveChunks({
      userId: doc.userId,
      documentIds: [documentId],
      query: q.question,
      limit: K,
      mode,
    });
    const rank = results.findIndex((r) => covers(r, q.pages));
    if (rank === 0) hit1 += 1;
    if (rank >= 0 && rank < 3) hit3 += 1;
    if (rank >= 0) {
      hitK += 1;
      reciprocalRanks += 1 / (rank + 1);
    }
    if (mode === 'hybrid' && rank < 0) misses.push(q.question);
  }
  rows.push({
    mode,
    'hit@1': pct(hit1),
    'hit@3': pct(hit3),
    [`hit@${K}`]: pct(hitK),
    MRR: (reciprocalRanks / answerable.length).toFixed(2),
  });
}

console.log(`\n${doc.title}: ${answerable.length} answerable questions, k=${K}\n`);
console.table(rows);
if (misses.length) console.log('\nHybrid misses:\n' + misses.map((m) => `  - ${m}`).join('\n'));

// Top vector scores, answerable vs. unanswerable: where to set QA_MIN_SCORE.
const topScore = async (q) =>
  (
    await retrieveChunks({
      userId: doc.userId,
      documentIds: [documentId],
      query: q.question,
      limit: 1,
      mode: 'vector',
    })
  ).results[0]?.vectorScore ?? 0;
if (unanswerable.length) {
  const inScope = await Promise.all(answerable.map(topScore));
  const outOfScope = await Promise.all(unanswerable.map(topScore));
  console.log(`\nTop vector score, answerable:   min ${Math.min(...inScope).toFixed(3)}`);
  console.log(`Top vector score, unanswerable: max ${Math.max(...outOfScope).toFixed(3)}`);
}

await disconnectDB();
