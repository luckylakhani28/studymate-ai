import { z } from 'zod';
import { pagesFor } from './digest.js';

const withPages =
  (passages) =>
  ({ sources, ...item }) => ({ ...item, pages: pagesFor(sources, passages) });

/** Models favor certain answer positions, so shuffling on the server removes that bias entirely. */
function shuffleOptions(q) {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answerIndex: order.indexOf(q.answerIndex),
  };
}

/** Per type: which prompt, which options are allowed, and how model output becomes stored content. */
export const ARTIFACT_SPECS = {
  summary: {
    prompt: 'document_summary',
    toContent: (d, p) => ({
      tldr: d.tldr,
      overview: d.overview,
      keyPoints: d.keyPoints.map(withPages(p)),
    }),
  },
  notes: {
    prompt: 'study_notes',
    toContent: (d, p) => ({
      sections: d.sections.map((s) => ({ heading: s.heading, points: s.points.map(withPages(p)) })),
    }),
  },
  key_concepts: {
    prompt: 'key_concepts',
    toContent: (d, p) => ({ concepts: d.concepts.map(withPages(p)) }),
  },
  quiz: {
    prompt: 'quiz',
    options: z.strictObject({
      count: z.number().int().min(3).max(20).default(10),
      difficulty: z.enum(['easy', 'mixed', 'hard']).default('mixed'),
    }),
    toContent: (d, p) => ({ questions: d.questions.map(withPages(p)).map(shuffleOptions) }),
  },
  flashcards: {
    prompt: 'flashcards',
    options: z.strictObject({ count: z.number().int().min(5).max(40).default(20) }),
    toContent: (d, p) => ({ cards: d.cards.map(withPages(p)) }),
  },
};
