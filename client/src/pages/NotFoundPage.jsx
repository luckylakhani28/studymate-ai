import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-reading text-3xl font-semibold">This page doesn’t exist</h1>
      <p className="mt-3 text-ink-soft">The link may be broken, or the page may have moved.</p>
      <Link to="/" className="mt-8 inline-block font-semibold underline underline-offset-4">
        Go to your library
      </Link>
    </main>
  );
}
