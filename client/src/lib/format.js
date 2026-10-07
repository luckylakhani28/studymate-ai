export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
export const formatDate = (iso) => dateFormat.format(new Date(iso));

/** [3,4,5,9] → "pp. 3–5, 9" */
export function formatPages(pages = []) {
  if (!pages.length) return '';
  const ranges = [];
  let start = pages[0];
  let prev = pages[0];
  for (const page of [...pages.slice(1), null]) {
    if (page === prev + 1) {
      prev = page;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = page;
  }
  return `${pages.length === 1 ? 'p.' : 'pp.'} ${ranges.join(', ')}`;
}

export const pageRange = (start, end) => (start === end ? `p. ${start}` : `pp. ${start}–${end}`);
