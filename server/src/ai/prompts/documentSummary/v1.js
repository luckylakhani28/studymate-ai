import { z } from 'zod';
import { defineStudyPrompt, sourced } from '../studyPrompt.js';

export default defineStudyPrompt({
  id: 'document_summary',
  version: 1,
  tier: 'smart',
  maxTokens: 2000,
  output: z.strictObject({
    tldr: z.string().min(1).max(300).describe('One sentence: what this document is about'),
    overview: z.string().min(1).max(3000).describe('2–4 short paragraphs separated by blank lines'),
    keyPoints: z
      .array(sourced({ point: z.string().min(1).max(300) }))
      .min(3)
      .max(12),
  }),
  items: (d) => d.keyPoints,
  task: 'Write a revision summary of the whole document from these section digests: a one-sentence TL;DR, a short overview, and the most important key points.',
});
