const LIGATURES = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
};
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g; // zero-width chars and soft hyphens
const ODD_SPACES = /[\u00A0\u2007\u202F\t]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const PAGE_NUMBER = /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i;
const BULLET = /^([•◦▪▫●○■□►▸‣⁃–-]|\*|\d{1,2}[.)]|[a-z][.)])\s+/u;
const NUMBERED_HEADING = /^(\d+(\.\d+){0,3}\.?|[IVX]{1,5}\.|[A-Z]\.)\s+\p{L}/u;
const KEYWORD_HEADING =
  /^(chapter|section|unit|module|lecture|part|appendix)\s+([\dIVX]+|[A-Z])\b/i;
const EDGE_LINES = 2; // headers/footers live in the first/last two lines of a page

/** NFC, not NFKC: NFKC would turn x² into x2 and break formulas. Ligatures are mapped explicitly. */
export function normalizeUnicode(text) {
  return text
    .normalize('NFC')
    .replace(/[\uFB00-\uFB06]/g, (c) => LIGATURES[c])
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(ODD_SPACES, ' ')
    .replace(CONTROL, '')
    .replace(/ {2,}/g, ' ');
}

const toLines = (text) =>
  normalizeUnicode(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

// "Page 3 of 40" and "Page 4 of 40" share a signature, so they're counted as the same line.
const signature = (line) => line.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ');

/** Lines appearing at a page edge on at least half the pages (min 3) are running headers/footers. */
export function findRepeatedEdgeLines(pagesLines) {
  const withText = pagesLines.filter((lines) => lines.length > 0);
  if (withText.length < 3) return new Set();

  const counts = new Map();
  for (const lines of withText) {
    const edges = new Set(
      [...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)].map(signature),
    );
    for (const sig of edges) counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(withText.length * 0.5));
  return new Set([...counts].filter(([, n]) => n >= threshold).map(([sig]) => sig));
}

function stripEdges(lines, repeated) {
  const isNoise = (line) => repeated.has(signature(line)) || PAGE_NUMBER.test(line);
  let start = 0;
  let end = lines.length;
  while (start < end && start < EDGE_LINES && isNoise(lines[start])) start += 1;
  while (end > start && lines.length - end < EDGE_LINES && isNoise(lines[end - 1])) end -= 1;
  return lines.slice(start, end);
}

export function isHeading(line, outlineTitles = new Set()) {
  if (line.length < 3 || line.length > 90) return false;
  if (outlineTitles.has(line.toLowerCase())) return true; // the PDF's own bookmarks: strongest signal
  if (/[.,;]$/.test(line)) return false; // sentences end with punctuation; headings don't
  const words = line.split(/\s+/).length;
  if (KEYWORD_HEADING.test(line)) return true;
  if (NUMBERED_HEADING.test(line) && words <= 10) return true;
  const letters = line.replace(/[^\p{L}]/gu, '');
  // ALL CAPS. The \p{Lu} check stops scripts without case (e.g. Devanagari) from matching.
  return (
    letters.length >= 4 &&
    words <= 8 &&
    /\p{Lu}/u.test(letters) &&
    letters === letters.toUpperCase()
  );
}

function joinLine(paragraph, line) {
  if (!paragraph) return line;
  // "frag-" + "mentation" → "fragmentation". Only when the next line continues in lowercase.
  if (/\p{L}-$/u.test(paragraph) && /^\p{Ll}/u.test(line)) return paragraph.slice(0, -1) + line;
  return `${paragraph} ${line}`;
}

/** Pages → ordered blocks: { type: 'heading' | 'text', text, page }. */
export function buildBlocks(pages, { outline = [] } = {}) {
  const outlineTitles = new Set(outline.map((item) => item.title.toLowerCase().trim()));
  const pagesLines = pages.map((p) => toLines(p.text));
  const repeated = findRepeatedEdgeLines(pagesLines);
  const blocks = [];

  pagesLines.forEach((rawLines, i) => {
    const page = pages[i].pageNumber;
    let paragraph = '';
    const flush = () => {
      if (paragraph) blocks.push({ type: 'text', text: paragraph, page });
      paragraph = '';
    };

    for (const line of stripEdges(rawLines, repeated)) {
      if (isHeading(line, outlineTitles)) {
        flush();
        blocks.push({ type: 'heading', text: line, page });
      } else if (BULLET.test(line)) {
        flush();
        paragraph = line; // each bullet is its own block; its wrapped lines join it
      } else {
        paragraph = joinLine(paragraph, line);
      }
    }
    flush();
  });

  return blocks;
}
