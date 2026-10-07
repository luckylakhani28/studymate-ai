import sectionSummaryV1 from './sectionSummary/v1.js';
import documentSummaryV1 from './documentSummary/v1.js';
import studyNotesV1 from './studyNotes/v1.js';
import keyConceptsV1 from './keyConcepts/v1.js';
import quizV1 from './quiz/v1.js';
import flashcardsV1 from './flashcards/v1.js';
import qaV1 from './qa/v1.js';
import queryRewriteV1 from './queryRewrite/v1.js';
import conversationSummaryV1 from './conversationSummary/v1.js';

// To change a prompt: add vN.js, list it as { active: N, versions: [v1, …, vN] }. Old versions stay
// for reproducing cached artifacts (which record their promptVersion) and for instant rollback.
const REGISTRY = Object.fromEntries(
  [
    sectionSummaryV1,
    documentSummaryV1,
    studyNotesV1,
    keyConceptsV1,
    quizV1,
    flashcardsV1,
    qaV1,
    queryRewriteV1,
    conversationSummaryV1,
  ].map((p) => [p.id, { active: p.version, versions: [p] }]),
);

export function getPrompt(id, version) {
  const entry = REGISTRY[id];
  if (!entry) throw new Error(`Unknown prompt: ${id}`);
  const wanted = version ?? entry.active;
  const prompt = entry.versions.find((p) => p.version === wanted);
  if (!prompt) throw new Error(`Unknown version ${wanted} of prompt ${id}`);
  return prompt;
}
