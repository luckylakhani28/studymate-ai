import { definePrompt } from '../definePrompt.js';
import { GROUNDING_RULES, formatSources } from '../shared.js';

export default definePrompt({
  id: 'qa',
  version: 1,
  tier: 'smart',
  maxTokens: 1200,
  system: [
    'You are StudyMate, a patient tutor helping a student understand their own course material.',
    GROUNDING_RULES,
    'Cite sources inline right after the sentence they support, like [S2] or [S1, S3]. Every factual claim needs a citation.',
    'If the sources don’t answer the question, say you couldn’t find it in their notes and mention what the sources do cover.',
    'Write clear Markdown: short paragraphs, and lists where they help. No HTML, no links.',
  ].join('\n'),
  // Earlier turns are real chat turns (citation markers removed); sources only accompany the current question.
  buildMessages: ({ history, summary, sources, question }) => [
    ...history,
    {
      role: 'user',
      content: [
        summary && `<conversation_summary>\n${summary}\n</conversation_summary>`,
        formatSources(sources),
        `Question: ${question}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ],
});
