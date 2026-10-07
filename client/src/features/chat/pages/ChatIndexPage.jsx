import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../chatApi.js';
import { useDocuments } from '../../documents/hooks.js';
import { formatDate } from '../../../lib/format.js';
import { getErrorMessage } from '../../../lib/errors.js';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';

export default function ChatIndexPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const conversations = useQuery({ queryKey: ['conversations'], queryFn: chatApi.list });
  const documents = useDocuments();
  const readyDocs = documents.data?.documents.filter((d) => d.status === 'ready') ?? [];
  const [selected, setSelected] = useState([]);

  const create = useMutation({
    mutationFn: chatApi.create,
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate(`/chat/${conversation.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: chatApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const toggle = (id) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 10 ? [...s, id] : s,
    );

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">Chat</h1>
      <p className="mt-2 text-ink-soft">
        Ask questions across your documents. Every answer cites the pages it comes from.
      </p>

      <form
        className="mt-8 rounded-md border border-rule bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ documentIds: selected });
        }}
      >
        <fieldset>
          <legend className="font-semibold">Start a conversation with up to 10 documents</legend>
          {readyDocs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Upload a PDF and wait until it’s ready.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {readyDocs.map((d) => (
                <li key={d.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      onChange={() => toggle(d.id)}
                    />
                    <span className="truncate">{d.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        {create.isError && (
          <div className="mt-3">
            <Alert>{getErrorMessage(create.error)}</Alert>
          </div>
        )}
        <Button
          type="submit"
          className="mt-4"
          disabled={selected.length === 0}
          loading={create.isPending}
        >
          Start conversation
        </Button>
      </form>

      <h2 className="mt-12 font-reading text-xl font-semibold">Your conversations</h2>
      {conversations.isPending && (
        <p role="status" className="mt-3 text-ink-soft">
          Loading…
        </p>
      )}
      {conversations.isError && (
        <p role="alert" className="mt-3 text-danger">
          {getErrorMessage(conversations.error)}
        </p>
      )}
      {conversations.data?.length === 0 && (
        <p className="mt-3 text-ink-soft">No conversations yet.</p>
      )}
      {conversations.data?.length > 0 && (
        <ul className="mt-4 divide-y divide-rule rounded-md border border-rule bg-white">
          {conversations.data.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-4 py-3">
              <Link to={`/chat/${c.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold hover:underline">{c.title}</span>
                <span className="text-sm text-ink-soft">
                  {c.messageCount} messages, last active {formatDate(c.lastMessageAt)}
                </span>
              </Link>
              <Button
                variant="danger"
                onClick={() => window.confirm(`Delete “${c.title}”?`) && remove.mutate(c.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
