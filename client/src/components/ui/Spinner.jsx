export function Spinner({ className = 'size-5' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function FullPageLoader({ label = 'Loading your session' }) {
  return (
    <div role="status" className="grid min-h-screen place-items-center text-ink-soft">
      <span className="flex items-center gap-3">
        <Spinner />
        {label}
      </span>
    </div>
  );
}
