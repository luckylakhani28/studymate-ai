import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../chatApi.js';
import { streamMessage } from '../streamMessage.js';
import { AnswerMarkdown } from '../components/AnswerMarkdown.jsx';
import { openDocumentAtPage } from '../../documents/openDocument.js';
import { pageRange } from '../../../lib/format.js';
import { getErrorMessage } from '../../../lib/errors.js';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';

const openSource = (c) => openDocumentAtPage(c.documentId, c.pageStart);

function SourceList({ citations }) {
  if (!citations?.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-sm text-ink-soft">
      {citations.map((c) => (
        <li key={c.label}>
          <button
            type="button"
            className="text-left hover:text-ink hover:underline"
            onClick={() => openSource(c)}
          >
            <span className="font-semibold text-ink">{c.label}</span> {c.documentTitle},{' '}
            {pageRange(c.pageStart, c.pageEnd)}
            {c.sectionTitle ? `, ${c.sectionTitle}` : ''}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <li className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-md bg-ink px-4 py-3 text-paper">
        {message.content}
      </li>
    );
  }
  return (
    <li className="max-w-[85%] rounded-md border border-rule bg-white px-4 py-3">
      <div className="answer leading-7">
        <AnswerMarkdown
          text={message.content}
          citations={message.citations ?? []}
          onCite={openSource}
        />
      </div>
      {message.status === 'stopped' && (
        <p className="mt-2 text-sm text-ink-soft">Stopped before finishing.</p>
      )}
      {message.status === 'error' && (
        <p className="mt-2 text-sm text-danger">This answer didn’t finish.</p>
      )}
      <SourceList citations={message.citations} />
    </li>
  );
}

function Composer({ onSend, onStop, streaming }) {
  const [value, setValue] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue('');
  };
  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 mt-6 border-t border-rule bg-paper pt-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <label htmlFor="question" className="sr-only">
        Your question
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="question"
          rows={2}
          maxLength={2000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          placeholder="Ask a question about your notes"
          className="min-h-12 flex-1 resize-none rounded-md border border-ink-soft/80 bg-white px-3 py-2.5"
        />
        {streaming ? (
          <Button variant="quiet" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!value.trim()}>
            Ask
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft">Enter to send, Shift+Enter for a new line.</p>
    </form>
  );
}

export default function ConversationPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const conversation = useQuery({
    queryKey: ['conversations', id],
    queryFn: () => chatApi.get(id),
  });
  const [draft, setDraft] = useState(null); // { userMessage, text, sources } while an answer streams
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation.data, draft?.text]);

  async function send(content) {
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setDraft({ userMessage: { id: 'pending', role: 'user', content }, text: '', sources: [] });
    try {
      await streamMessage(id, content, {
        signal: controller.signal,
        onEvent: (event, data) => {
          if (event === 'start')
            setDraft((d) => ({ ...d, userMessage: data.userMessage, sources: data.sources }));
          if (event === 'token') setDraft((d) => ({ ...d, text: d.text + data.text }));
          if (event === 'error') setError(data.message);
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError')
        setError(
          err instanceof TypeError ? 'Can’t reach the server. Check your connection.' : err.message,
        );
    } finally {
      abortRef.current = null;
      await queryClient.invalidateQueries({ queryKey: ['conversations'] }); // load the saved messages, then drop the draft
      setDraft(null);
    }
  }

  if (conversation.isPending) {
    return (
      <p role="status" className="text-ink-soft">
        Loading conversation…
      </p>
    );
  }
  if (conversation.isError) {
    return (
      <p role="alert" className="text-danger">
        {getErrorMessage(conversation.error)}
      </p>
    );
  }

  const { conversation: conv, messages } = conversation.data;

  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col">
      <Link to="/chat" className="text-sm text-ink-soft underline underline-offset-4">
        All conversations
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{conv.title}</h1>

      <ol className="mt-6 flex flex-1 flex-col gap-4">
        {messages.length === 0 && !draft && (
          <li className="text-ink-soft">
            Ask anything about the documents in this conversation. Answers cite the pages they come
            from.
          </li>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {draft && (
          <>
            <ChatMessage message={draft.userMessage} />
            <li
              className="max-w-[85%] rounded-md border border-rule bg-white px-4 py-3"
              aria-busy="true"
            >
              {draft.text ? (
                <div className="answer leading-7">
                  <AnswerMarkdown text={draft.text} citations={draft.sources} onCite={openSource} />
                </div>
              ) : (
                <p className="flex items-center gap-2 text-ink-soft">
                  <Spinner className="size-4" />
                  Searching your notes…
                </p>
              )}
            </li>
          </>
        )}
      </ol>

      <p role="status" className="sr-only">
        {draft ? 'Writing an answer' : ''}
      </p>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div ref={endRef} />
      <Composer onSend={send} onStop={() => abortRef.current?.abort()} streaming={Boolean(draft)} />
    </section>
  );
}
