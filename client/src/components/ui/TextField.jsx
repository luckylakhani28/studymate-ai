import { useId } from 'react';

export function TextField({ label, error, hint, ...inputProps }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className="rounded-md border border-ink-soft/80 bg-white px-3 py-2.5 aria-invalid:border-danger"
        {...inputProps}
      />
      {message && (
        <p id={messageId} className={`text-sm ${error ? 'text-danger' : 'text-ink-soft'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
