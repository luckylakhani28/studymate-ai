import { z } from 'zod';
import { defineStudyPrompt, sourced } from '../studyPrompt.js';

export default defineStudyPrompt({
  id: 'key_concepts',
  version: 1,
  tier: 'fast',
  maxTokens: 2500,
  output: z.strictObject({
    concepts: z
      .array(sourced({ term: z.string().min(1).max(100), definition: z.string().min(1).max(400) }))
      .min(1)
      .max(25),
  }),
  items: (d) => d.concepts,
  task: 'List the most important concepts and terms in this document, in the order they appear, with short definitions taken from the sources.',
});
