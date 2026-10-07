// Usage: npm run eval:qa -w server -- <documentId> /abs/questions.json [--budgets 1500,3000] [--models smart,fast]
// Real API calls: roughly (questions × configurations) answers. Check the cost first.
import { readFile } from 'node:fs/promises';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { StudyDocument } from '../models/index.js';
import { llm } from '../ai/llm.js';
import { extractCitations } from '../ai/citations.js';
import { buildContext } from '../services/chat.service.js';

const [documentId, file, ...flags] = process.argv.slice(2);
if (!documentId || !file) {
  console.error(
    'Usage: npm run eval:qa -w server -- <documentId> /abs/questions.json [--budgets 1500,3000] [--models smart,fast]',
  );
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = flags.indexOf(`--${name}`);
  return (i >= 0 ? flags[i + 1] : fallback).split(',');
};
const budgets = flag('budgets', String(env.QA_CONTEXT_TOKENS)).map(Number);
const models = flag('models', 'smart');
const MODEL_IDS = { smart: env.AI_MODEL_SMART, fast: env.AI_MODEL_FAST };

const questions = JSON.parse(await readFile(file, 'utf8'));
const covers = (c, pages) => pages.some((p) => p >= c.pageStart && p <= c.pageEnd);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');

await connectDB();
const doc = await StudyDocument.findById(documentId).lean();
if (!doc) throw new Error('Document not found');

const rows = [];
for (const budget of budgets) {
  for (const tier of models) {
    let cited = 0;
    let answerable = 0;
    let refused = 0;
    let unanswerable = 0;
    let cost = 0;
    const inputs = [];
    const latencies = [];

    for (const q of questions) {
      const started = Date.now();
      const ctx = await buildContext({
        userId: doc.userId,
        documentIds: [doc._id],
        query: q.question,
        budget,
      });
      let text = '';
      if (ctx.grounded) {
        const res = await llm.runPrompt(
          'qa',
          { history: [], summary: '', sources: ctx.sources, question: q.question },
          { userId: doc.userId, feature: 'eval_qa', model: MODEL_IDS[tier] },
        );
        text = res.text;
        inputs.push(res.usage.inputTokens);
        cost += res.usage.costUsd;
      }
      latencies.push(Date.now() - started);

      if (q.pages.length) {
        answerable += 1;
        if (extractCitations(text, ctx.sources).some((c) => covers(c, q.pages))) cited += 1;
      } else {
        unanswerable += 1;
        if (!ctx.grounded || /couldn.t find/i.test(text)) refused += 1;
      }
    }

    rows.push({
      budget,
      model: tier,
      'cites right page': pct(cited, answerable),
      'refuses off-topic': pct(refused, unanswerable),
      'median in tokens': median(inputs),
      'cost $': cost.toFixed(4),
      'median ms': median(latencies),
    });
  }
}

console.table(rows);
await disconnectDB();
