export function Alert({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
    >
      {children}
    </div>
  );
}
