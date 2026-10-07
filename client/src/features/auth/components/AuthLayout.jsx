import { Link } from 'react-router';

function NotesSheet() {
  return (
    <aside
      aria-hidden="true"
      className="hidden items-center justify-center bg-rule/30 p-10 lg:flex xl:p-16"
    >
      <div className="ruled-paper w-full max-w-xl -rotate-1 rounded-sm pb-8 pl-20 pr-8 pt-16 font-reading text-lg leading-8 ring-1 ring-rule">
        <p className="text-ink-soft">Operating Systems, lecture 6</p>
        <p className="mt-8">
          Paging splits memory into fixed-size frames, so a process no longer needs one contiguous
          block. The price is translation: every address has to be looked up in the page table.{' '}
          <span className="highlight-sweep">
            A TLB caches recent translations, so most lookups never reach the page table.
          </span>
        </p>
        <div className="mt-8 border-l-2 border-ink/20 pl-4 font-sans text-base leading-8">
          <p className="font-semibold">Why is the TLB fast?</p>
          <p className="text-ink-soft">
            It keeps recent page-table entries in a small hardware cache. See page 14.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function AuthLayout({ title, footer, children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      <NotesSheet />
      <main className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="font-reading text-2xl font-semibold">
            StudyMate
          </Link>
          <p className="mt-2 text-ink-soft">
            Ask questions about your lecture notes and get answers that point back to the page.
          </p>
          <h1 className="mt-10 text-3xl font-bold tracking-tight">{title}</h1>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-ink-soft">{footer}</p>
        </div>
      </main>
    </div>
  );
}
