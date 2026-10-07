export function getErrorMessage(error) {
  if (!error) return null;
  if (!error.response) return "Can't reach the server. Check your connection and try again.";
  return error.response.data?.error?.message ?? 'Something went wrong. Try again.';
}

/** Maps API details like { field: "body.email" } to { email: "..." } for form fields. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.field.replace(/^body\./, ''), d.message]));
}
