import { useRouteError } from 'react-router';

export default function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-reading text-3xl font-semibold">This screen failed to load</h1>
      <p className="mt-3 text-ink-soft">
        Reload the page. If it keeps happening, log out and back in.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-8 font-semibold underline underline-offset-4"
      >
        Reload page
      </button>
    </main>
  );
}
