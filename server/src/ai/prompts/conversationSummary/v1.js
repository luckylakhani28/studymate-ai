import { definePrompt } from '../definePrompt.js';

export default definePrompt({
  id: 'conversation_summary',
  version: 1,
  tier: 'fast',
  maxTokens: 400,
  system: 'You maintain a brief running summary of a tutoring conversation.',
  buildMessages: ({ previousSummary, messages }) => [
    {
      role: 'user',
      content: `${previousSummary ? `Summary so far:\n${previousSummary}\n\n` : ''}New messages:\n${messages
        .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 1500)}`)
        .join(
          '\n',
        )}\n\nWrite an updated summary in under 150 words: the topics the student asked about and the key answers. Plain text.`,
    },
  ],
});
