import { useArtifacts, useRequestArtifact } from '../hooks.js';
import { ConceptsView, FlashcardsView, NotesView, QuizView, SummaryView } from './StudyViews.jsx';
import { getErrorMessage } from '../../../lib/errors.js';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';

const TYPES = {
  summary: {
    View: SummaryView,
    intro:
      'A one-sentence overview, a short summary, and the key points, each linked to its pages.',
    action: 'Create summary',
  },
  notes: {
    View: NotesView,
    intro: 'Structured revision notes that follow the order of the document.',
    action: 'Create study notes',
  },
  key_concepts: {
    View: ConceptsView,
    intro: 'The important terms and their definitions, in the order they appear.',
    action: 'Find key concepts',
  },
  quiz: {
    View: QuizView,
    intro: 'Multiple-choice questions with explanations, to check what you remember.',
    action: 'Create a 10-question quiz',
    options: { count: 10 },
    again: 'Create a new quiz',
  },
  flashcards: {
    View: FlashcardsView,
    intro: 'Question-and-answer cards for quick revision.',
    action: 'Create 20 flashcards',
    options: { count: 20 },
    again: 'Create a new set',
  },
};
const STAGE = { mapping: 'Reading the whole document', writing: 'Writing' };

export function StudyPanel({ documentId, type }) {
  const { View, intro, action, options, again } = TYPES[type];
  const artifacts = useArtifacts(documentId, type);
  const create = useRequestArtifact(documentId, type);
  const latest = artifacts.data?.[0];
  const busy = latest?.status === 'queued' || latest?.status === 'processing';

  if (artifacts.isPending) {
    return (
      <p role="status" className="text-ink-soft">
        Loading…
      </p>
    );
  }
  if (artifacts.isError) return <Alert>{getErrorMessage(artifacts.error)}</Alert>;

  return (
    <section>
      {create.isError && (
        <div className="mb-4">
          <Alert>{getErrorMessage(create.error)}</Alert>
        </div>
      )}

      {!latest && (
        <div>
          <p className="max-w-prose text-ink-soft">{intro}</p>
          <Button
            className="mt-4"
            loading={create.isPending}
            onClick={() => create.mutate({ options })}
          >
            {action}
          </Button>
        </div>
      )}

      {busy && (
        <p role="status" className="flex items-center gap-3 text-ink-soft">
          <Spinner />
          {latest.status === 'queued'
            ? 'Waiting to start.'
            : `${STAGE[latest.processing?.stage] ?? 'Working'}, ${latest.processing?.progress ?? 0}%.`}{' '}
          Long documents take a minute or two.
        </p>
      )}

      {latest?.status === 'failed' && (
        <div role="alert">
          <p className="text-danger">
            {latest.processing?.lastError?.message ?? 'This couldn’t be created.'}
          </p>
          <Button
            variant="quiet"
            className="mt-2"
            loading={create.isPending}
            onClick={() => create.mutate({ options: latest.options })}
          >
            Try again
          </Button>
        </div>
      )}

      {latest?.status === 'ready' && (
        <>
          <View key={latest.id} content={latest.content} documentId={documentId} />
          {again && (
            <Button
              variant="quiet"
              className="mt-10"
              loading={create.isPending}
              onClick={() => create.mutate({ options, regenerate: true })}
            >
              {again}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
