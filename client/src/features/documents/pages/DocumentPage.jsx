import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useDocument, useDocumentChunks } from '../hooks.js';
import { chatApi } from '../../chat/chatApi.js';
import { StudyPanel } from '../../study/components/StudyPanel.jsx';
import { getErrorMessage } from '../../../lib/errors.js';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';

const METHOD_LABEL = {
  text: 'Typed text',
  ocr: 'Scanned, read with OCR',
  mixed: 'Typed and scanned pages',
};

const VIEWS = [
  { key: 'summary', label: 'Summary' },
  { key: 'notes', label: 'Notes' },
  { key: 'key_concepts', label: 'Key concepts' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'source', label: 'Source text' },
];

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Outline({ items }) {
  return (
    <section>
      <h2 className="font-reading text-xl font-semibold">Contents</h2>
      <ol className="mt-3 space-y-1.5">
        {items.map((item, i) => (
          <li
            key={`${item.title}-${i}`}
            className="flex justify-between gap-4 text-sm"
            style={{ paddingLeft: `${(item.level - 1) * 1.25}rem` }}
          >
            <span>{item.title}</span>
            {item.page && <span className="shrink-0 text-ink-soft">p. {item.page}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PassageList({ query }) {
  const chunks = query.data?.pages.flatMap((page) => page.chunks) ?? [];
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-reading text-xl font-semibold">Processed text</h2>
      <p className="mt-1 text-sm text-ink-soft">
        This is the text StudyMate reads when it answers your questions.
      </p>

      {query.isPending && (
        <p role="status" className="mt-4 text-ink-soft">
          Loading passages…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="mt-4 text-danger">
          {getErrorMessage(query.error)}
        </p>
      )}

      <ol className="mt-4 space-y-4">
        {chunks.map((chunk) => (
          <li key={chunk.id} className="rounded-md border border-rule bg-white p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>
                {chunk.pageStart === chunk.pageEnd
                  ? `Page ${chunk.pageStart}`
                  : `Pages ${chunk.pageStart}–${chunk.pageEnd}`}
                {chunk.sectionTitle && `, ${chunk.sectionTitle}`}
              </span>
              {chunk.lowConfidence && (
                <span className="rounded-full bg-highlight/70 px-2 py-0.5 text-xs font-semibold text-ink">
                  Hard to read
                </span>
              )}
            </p>
            <p className="mt-2 whitespace-pre-line font-reading leading-7">{chunk.text}</p>
          </li>
        ))}
      </ol>

      {query.hasNextPage && (
        <Button
          variant="quiet"
          className="mt-4"
          loading={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          Show more passages
        </Button>
      )}
    </section>
  );
}

export default function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some((v) => v.key === params.get('view')) ? params.get('view') : 'summary';

  const document = useDocument(id);
  const doc = document.data;
  const passages = useDocumentChunks(id, doc?.status === 'ready' && view === 'source');
  const startChat = useMutation({
    mutationFn: () => chatApi.create({ documentIds: [id] }),
    onSuccess: (conversation) => navigate(`/chat/${conversation.id}`),
  });

  if (document.isPending) {
    return (
      <p role="status" className="text-ink-soft">
        Loading document…
      </p>
    );
  }
  if (document.isError) {
    return (
      <div role="alert">
        <p className="text-danger">{getErrorMessage(document.error)}</p>
        <Link to="/" className="mt-4 inline-block font-semibold underline underline-offset-4">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <article>
      <Link to="/" className="text-sm text-ink-soft underline underline-offset-4">
        Back to library
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{doc.title}</h1>

      {doc.status !== 'ready' ? (
        <p className="mt-4 text-ink-soft">
          {doc.status === 'failed'
            ? (doc.processing?.lastError?.message ?? 'Processing failed.')
            : 'This document is still being processed. This page updates by itself.'}
        </p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <Fact label="Pages" value={doc.pageCount} />
            <Fact label="Source" value={METHOD_LABEL[doc.extraction?.method] ?? 'Unknown'} />
            <Fact label="Passages" value={doc.stats.chunkCount} />
            <Fact label="Estimated tokens" value={doc.stats.tokenCount.toLocaleString()} />
          </dl>

          <div className="mt-6">
            <Button loading={startChat.isPending} onClick={() => startChat.mutate()}>
              Ask about this document
            </Button>
            {startChat.isError && (
              <div className="mt-3">
                <Alert>{getErrorMessage(startChat.error)}</Alert>
              </div>
            )}
          </div>

          <nav aria-label="Study tools" className="mt-10 flex flex-wrap gap-1 border-b border-rule">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-current={view === v.key ? 'page' : undefined}
                onClick={() => setParams({ view: v.key }, { replace: true })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                  view === v.key
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>

          <div className="mt-8">
            {view === 'source' ? (
              <>
                {doc.metadata?.outline?.length > 0 && <Outline items={doc.metadata.outline} />}
                <PassageList query={passages} />
              </>
            ) : (
              <StudyPanel key={view} documentId={id} type={view} />
            )}
          </div>
        </>
      )}
    </article>
  );
}
