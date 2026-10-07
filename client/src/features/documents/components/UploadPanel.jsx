import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../documentsApi.js';
import { documentKeys } from '../hooks.js';
import { getErrorMessage } from '../../../lib/errors.js';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../../../lib/constants.js';
import { Button } from '../../../components/ui/Button.jsx';

function validateFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files can be uploaded.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return `This file is larger than ${MAX_UPLOAD_MB} MB.`;
  return null;
}

const STATE_LABEL = { waiting: 'Waiting', done: 'Uploaded', error: 'Not uploaded' };

function UploadQueue({ items, onClear }) {
  const hasFinished = items.some((i) => i.state === 'done' || i.state === 'error');
  return (
    <div className="mt-4">
      <ul
        aria-live="polite"
        className="divide-y divide-rule rounded-md border border-rule bg-white"
      >
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate font-semibold">{item.name}</span>
              <span className={item.state === 'error' ? 'text-danger' : 'text-ink-soft'}>
                {item.state === 'uploading' ? `${item.progress}%` : STATE_LABEL[item.state]}
              </span>
            </div>
            {item.state === 'uploading' && (
              <div
                role="progressbar"
                aria-label={`Uploading ${item.name}`}
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule"
              >
                <div
                  className="h-full bg-ink transition-[width]"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}
            {item.error && <p className="mt-1 text-sm text-danger">{item.error}</p>}
          </li>
        ))}
      </ul>
      {hasFinished && (
        <Button variant="quiet" className="mt-2" onClick={onClear}>
          Clear finished
        </Button>
      )}
    </div>
  );
}

export function UploadPanel() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState([]);

  const patch = (id, changes) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  async function uploadFiles(fileList) {
    const batch = [...fileList].map((file) => {
      const error = validateFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        progress: 0,
        state: error ? 'error' : 'waiting',
        error,
      };
    });
    setItems((list) => [...batch, ...list]);

    // Sequential, not parallel: predictable progress and no burst against the upload rate limit.
    for (const item of batch.filter((i) => !i.error)) {
      patch(item.id, { state: 'uploading' });
      try {
        await documentsApi.upload(item.file, {
          onProgress: (progress) => patch(item.id, { progress }),
        });
        patch(item.id, { state: 'done', progress: 100 });
        queryClient.invalidateQueries({ queryKey: documentKeys.all });
      } catch (err) {
        patch(item.id, { state: 'error', error: getErrorMessage(err) });
      }
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-3 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-ink bg-highlight/25' : 'border-ink-soft/50 bg-white'
        }`}
      >
        <p className="font-reading text-lg">Drop PDFs here</p>
        <p className="text-sm text-ink-soft">
          Typed or scanned notes, up to {MAX_UPLOAD_MB} MB each.
        </p>
        <Button onClick={() => inputRef.current?.click()}>Choose files</Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          hidden
          onChange={(e) => {
            uploadFiles(e.target.files);
            e.target.value = ''; // allow re-selecting the same file after an error
          }}
        />
      </div>
      {items.length > 0 && (
        <UploadQueue
          items={items}
          onClear={() =>
            setItems((list) => list.filter((i) => i.state === 'waiting' || i.state === 'uploading'))
          }
        />
      )}
    </div>
  );
}
