import { z } from 'zod';
import { defineStudyPrompt, sourced } from '../studyPrompt.js';

const DIFFICULTY = {
  easy: 'straightforward recall questions',
  mixed: 'a mix of recall and application questions',
  hard: 'challenging questions that require applying or comparing ideas',
};

export default defineStudyPrompt({
  id: 'quiz',
  version: 1,
  tier: 'smart',
  maxTokens: 4000,
  cacheSources: true, // users regenerate quizzes: same sources, new output
  output: z.strictObject({
    questions: z
      .array(
        sourced({
          question: z.string().min(1).max(400),
          options: z.array(z.string().min(1).max(200)).length(4),
          answerIndex: z.number().int().min(0).max(3).describe('Index of the correct option'),
          explanation: z.string().min(1).max(500).describe('Why the correct option is right'),
        }),
      )
      .min(1)
      .max(20),
  }),
  items: (d) => d.questions,
  maxItems: (input) => input.count,
  task: ({ count, difficulty }) =>
    `Write ${count} multiple-choice questions: ${DIFFICULTY[difficulty]}. Each has exactly 4 options and one correct answer; wrong options must be plausible. Test understanding of the material, not trivia about the document itself.`,
});
