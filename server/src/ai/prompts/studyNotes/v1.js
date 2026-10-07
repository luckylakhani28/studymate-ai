import { z } from 'zod';
import { defineStudyPrompt, sourced } from '../studyPrompt.js';

export default defineStudyPrompt({
  id: 'study_notes',
  version: 1,
  tier: 'smart',
  maxTokens: 4000,
  output: z.strictObject({
    sections: z
      .array(
        z.strictObject({
          heading: z.string().min(1).max(120),
          points: z
            .array(sourced({ text: z.string().min(1).max(400) }))
            .min(1)
            .max(12),
        }),
      )
      .min(1)
      .max(20),
  }),
  items: (d) => d.sections.flatMap((s) => s.points),
  task: 'Turn these section digests into structured study notes: headings in document order, concise bullet points a student can revise from, and a definition wherever a term first appears.',
});
