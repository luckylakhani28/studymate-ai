import ReactMarkdown from 'react-markdown';
import { pageRange } from '../../../lib/format.js';

const MARKER = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;
// [S1, S2] → [S1](#cite-S1)[S2](#cite-S2), so Markdown parsing keeps citations as nodes we control.
const linkify = (text) =>
  text.replace(MARKER, (_, group) =>
    group
      .split(/\s*,\s*/)
      .map((label) => `[${label}](#cite-${label})`)
      .join(''),
  );

/** react-markdown never renders raw HTML. Links the model writes are shown as plain text, never as links. */
export function AnswerMarkdown({ text, citations, onCite }) {
  const byLabel = new Map(citations.map((c) => [c.label, c]));
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          const citation = href?.startsWith('#cite-') && byLabel.get(href.slice(6));
          if (!citation) return <span>{children}</span>;
          return (
            <button
              type="button"
              onClick={() => onCite(citation)}
              aria-label={`Source ${citation.label}: ${citation.documentTitle}, ${pageRange(citation.pageStart, citation.pageEnd)}`}
              className="mx-0.5 rounded bg-highlight/70 px-1 align-super text-xs font-semibold text-ink"
            >
              {citation.label}
            </button>
          );
        },
      }}
    >
      {linkify(text)}
    </ReactMarkdown>
  );
}
