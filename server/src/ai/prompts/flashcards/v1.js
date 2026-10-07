import { z } from 'zod';
import { defineStudyPrompt, sourced } from '../studyPrompt.js';

export default defineStudyPrompt({
  id: 'flashcards',
  version: 1,
  tier: 'fast',
  maxTokens: 3000,
  cacheSources: true, // users regenerate card sets: same sources, new output
  output: z.strictObject({
    cards: z
      .array(sourced({ front: z.string().min(1).max(200), back: z.string().min(1).max(500) }))
      .min(1)
      .max(40),
  }),
  items: (d) => d.cards,
  maxItems: (input) => input.count,
  task: ({ count }) =>
    `Write up to ${count} flashcards covering the whole document. Front: a question or a term. Back: a concise answer. One idea per card.`,
});
