import { useState } from 'react';
import { Link } from 'react-router';
import { useDeleteDocument, useReprocessDocument } from '../hooks.js';
import { openDocumentAtPage } from '../openDocument.js';
import { formatBytes, formatDate } from '../../../lib/format.js';
import { Button } from '../../../components/ui/Button.jsx';

const STATUS = {
  queued: { label: 'Waiting to process', className: 'bg-rule/60 text-ink' },
  processing: { label: 'Processing', className: 'bg-highlight/70 text-ink' },
  ready: { label: 'Ready', className: 'bg-emerald-100 text-emerald-900' },
  failed: { label: 'Failed', className: 'bg-danger/10 text-danger' },
};
const STAGE_LABEL = {
  extracting: 'Reading text',
  ocr: 'Scanning pages',
  chunking: 'Organizing text',
  embedding: 'Indexing for search',
};

function StatusBadge({ doc }) {
  const { label, className } = STATUS[doc.status] ?? STATUS.queued;
  const text =
    doc.status === 'processing'
      ? `${STAGE_LABEL[doc.processing?.stage] ?? 'Processing'}, ${doc.processing?.progress ?? 0}%`
      : label;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{text}</span>
  );
}

const pageWord = (n) => (n === 1 ? 'page' : 'pages');

function extractionNote(doc) {
  const ex = doc.extraction;
  if (doc.status !== 'ready' || !ex || ex.method === 'text') return null;
  const notes = ['Scanned pages were read with OCR.'];
  const low = ex.lowConfidencePages?.length ?? 0;
  const skipped = ex.ocrSkippedPages?.length ?? 0;
  if (low)
    notes.push(
      `${low} ${pageWord(low)} were hard to read, so answers from them may be less accurate.`,
    );
  if (skipped)
    notes.push(
      `${skipped} scanned ${pageWord(skipped)} weren’t read because the document is over the OCR limit.`,
    );
  return notes.join(' ');
}

function DocumentRow({ doc }) {
  const remove = useDeleteDocument();
  const reprocess = useReprocessDocument();
  const [openError, setOpenError] = useState(null);

  async function handleOpen() {
    setOpenError(null);
    if (!(await openDocumentAtPage(doc.id)))
      setOpenError('This file couldn’t be opened. Try again.');
  }

  function handleDelete() {
    if (window.confirm(`Delete “${doc.title}”? This can’t be undone.`)) remove.mutate(doc.id);
  }

  const error = openError ?? (remove.isError ? 'Delete failed. Try again.' : null);
  const note = extractionNote(doc);

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
      <div className="min-w-0 flex-1">
        <Link to={`/documents/${doc.id}`} className="block truncate font-semibold hover:underline">
          {doc.title}
        </Link>
        <p className="text-sm text-ink-soft">
          {formatBytes(doc.sizeBytes)}
          {doc.pageCount ? `, ${doc.pageCount} ${pageWord(doc.pageCount)}` : ''}, uploaded{' '}
          {formatDate(doc.createdAt)}
        </p>
        {note && <p className="mt-1 text-sm text-ink-soft">{note}</p>}
        {doc.status === 'failed' && (
          <p className="mt-1 text-sm text-danger">
            {doc.processing?.lastError?.message ?? 'Processing failed.'}
          </p>
        )}
        {doc.status === 'queued' && doc.processing?.lastError && (
          <p className="mt-1 text-sm text-ink-soft">Hit a problem. Retrying automatically.</p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <StatusBadge doc={doc} />
      <div className="flex gap-1">
        {doc.status === 'failed' && (
          <Button
            variant="quiet"
            loading={reprocess.isPending}
            onClick={() => reprocess.mutate(doc.id)}
          >
            Try again
          </Button>
        )}
        <Button variant="quiet" onClick={handleOpen}>
          Open
        </Button>
        <Button variant="danger" loading={remove.isPending} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}

export function DocumentList({ documents }) {
  return (
    <ul className="divide-y divide-rule rounded-md border border-rule bg-white">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </ul>
  );
}
