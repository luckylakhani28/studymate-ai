import { useDocuments } from '../hooks.js';
import { UploadPanel } from '../components/UploadPanel.jsx';
import { DocumentList } from '../components/DocumentList.jsx';
import { getErrorMessage } from '../../../lib/errors.js';

export default function LibraryPage() {
  const documents = useDocuments();
  const list = documents.data?.documents;

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">Your library</h1>
      <p className="mt-2 text-ink-soft">
        Add PDFs here. Once they’re processed, you can ask questions about them.
      </p>

      <div className="mt-8">
        <UploadPanel />
      </div>

      <h2 className="mt-12 font-reading text-xl font-semibold">Documents</h2>
      <div className="mt-4">
        {documents.isPending && (
          <p role="status" className="text-ink-soft">
            Loading your documents…
          </p>
        )}
        {documents.isError && (
          <p role="alert" className="text-danger">
            {getErrorMessage(documents.error)}{' '}
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => documents.refetch()}
            >
              Try again
            </button>
          </p>
        )}
        {list?.length === 0 && (
          <p className="text-ink-soft">No documents yet. Upload a PDF above to get started.</p>
        )}
        {list?.length > 0 && <DocumentList documents={list} />}
      </div>
    </section>
  );
}
