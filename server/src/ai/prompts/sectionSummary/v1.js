import { z } from 'zod';
import { definePrompt } from '../definePrompt.js';
import { GROUNDING_RULES, checkCitedSources, formatSources } from '../shared.js';

const output = z.strictObject({
  summary: z
    .string()
    .min(1)
    .max(1500)
    .describe('2–4 plain-language sentences a student can revise from'),
  keyPoints: z
    .array(
      z.strictObject({
        point: z.string().min(1).max(300).describe('One fact or idea worth remembering'),
        sources: z
          .array(z.string())
          .min(1)
          .describe('Ids of the sources supporting this point, e.g. ["S1"]'),
      }),
    )
    .min(1)
    .max(8),
});

export default definePrompt({
  id: 'section_summary',
  version: 1,
  tier: 'fast', // map step: many calls per document, so the cheapest capable model
  maxTokens: 800,
  system: `You help students revise from their own study material.\n${GROUNDING_RULES}`,
  buildMessages: ({ documentTitle, passages }) => [
    {
      role: 'user',
      content: `${formatSources(passages, { documentTitle })}\n\nSummarize these passages for revision and list the key points. Cite the source ids that support each point.`,
    },
  ],
  output,
  check: (data, { passages }) =>
    checkCitedSources(
      data.keyPoints.flatMap((k) => k.sources),
      passages,
    ),
});
