import { z } from 'zod';
import { definePrompt } from '../definePrompt.js';

export default definePrompt({
  id: 'query_rewrite',
  version: 1,
  tier: 'fast',
  maxTokens: 200,
  system:
    'You rewrite a student’s follow-up question into a standalone search query for their notes.',
  buildMessages: ({ history, question }) => [
    {
      role: 'user',
      content: `<conversation>\n${history
        .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 500)}`)
        .join(
          '\n',
        )}\n</conversation>\n\nLatest question: ${question}\n\nRewrite the latest question so it makes sense without the conversation, resolving words like "it" or "that". Keep it short. If it already stands alone, return it unchanged.`,
    },
  ],
  output: z.strictObject({ query: z.string().min(1).max(300) }),
});
