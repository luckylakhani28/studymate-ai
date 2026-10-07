import { Spinner } from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-ink text-paper hover:bg-ink/90 px-4 py-2.5',
  quiet: 'text-ink hover:bg-rule/40 px-3 py-2',
  danger: 'text-danger hover:bg-danger/10 px-3 py-2',
};

export function Button({
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
