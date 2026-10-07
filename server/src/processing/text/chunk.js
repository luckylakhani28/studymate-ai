// Sized for the embedding model: bge-small reads at most 512 subword tokens and silently ignores
// the rest. ~400 estimated tokens plus a section title stays under that.
export const CHUNK_DEFAULTS = Object.freeze({
  targetTokens: 400,
  overlapTokens: 60, // repeated at the next chunk's start, so ideas split at a boundary survive
  minTokens: 100, // don't start a new chunk at a heading if the current one is still tiny
  maxTokens: 480, // single sentences beyond this are force-split
});

/** ~4 characters per token for English. Exact counts only matter when assembling prompts. */
export const estimateTokens = (text) => Math.ceil(text.length / 4);

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const splitSentences = (text) =>
  [...segmenter.segment(text)].map((s) => s.segment.trim()).filter(Boolean);

function splitOversized(sentence, maxTokens) {
  const pieces = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (current && estimateTokens(next) > maxTokens) {
      pieces.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function render(units) {
  let out = '';
  for (const unit of units) {
    if (unit.kind === 'heading') out += `${out ? '\n\n' : ''}${unit.text}\n`;
    else if (unit.kind === 'break') out += out && !out.endsWith('\n') ? '\n' : '';
    else out += out && !out.endsWith('\n') ? ` ${unit.text}` : unit.text;
  }
  return out.trim();
}

function overlapTail(units, overlapTokens) {
  const tail = [];
  let total = 0;
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const unit = units[i];
    if (unit.kind !== 'sentence') continue;
    if (total + unit.tokens > overlapTokens) break;
    tail.unshift(unit);
    total += unit.tokens;
  }
  return tail;
}

/** Blocks → chunks: { index, text, tokenCount, pageStart, pageEnd, sectionTitle }. */
export function chunkBlocks(blocks, options = {}) {
  const { targetTokens, overlapTokens, minTokens, maxTokens } = { ...CHUNK_DEFAULTS, ...options };
  const chunks = [];
  let units = [];
  let tokens = 0;
  let section; // nearest heading seen so far
  let chunkSection; // heading in force where the current chunk began

  const emit = () => {
    if (!units.some((u) => u.kind === 'sentence')) return; // a heading alone isn't a passage
    const pages = units.filter((u) => u.page).map((u) => u.page);
    const text = render(units);
    chunks.push({
      index: chunks.length,
      text,
      tokenCount: estimateTokens(text),
      pageStart: Math.min(...pages),
      pageEnd: Math.max(...pages),
      sectionTitle: chunkSection,
    });
  };
  const startNext = (carry) => {
    units = carry;
    tokens = carry.reduce((sum, u) => sum + u.tokens, 0);
    chunkSection = section;
  };
  const push = (unit) => {
    if (units.length === 0) chunkSection = section;
    units.push(unit);
    tokens += unit.tokens;
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      if (tokens >= minTokens) {
        emit();
        startNext([]); // sections start fresh: no overlap across a topic change
      }
      section = block.text;
      push({
        kind: 'heading',
        text: block.text,
        page: block.page,
        tokens: estimateTokens(block.text),
      });
      continue;
    }

    for (const sentence of splitSentences(block.text)) {
      const pieces =
        estimateTokens(sentence) > maxTokens ? splitOversized(sentence, maxTokens) : [sentence];
      for (const piece of pieces) {
        const pieceTokens = estimateTokens(piece);
        if (tokens + pieceTokens > targetTokens && tokens >= minTokens) {
          emit();
          startNext(overlapTail(units, overlapTokens));
        }
        push({ kind: 'sentence', text: piece, page: block.page, tokens: pieceTokens });
      }
    }
    units.push({ kind: 'break', tokens: 0 }); // paragraph boundary, kept as a newline
  }

  emit();
  return chunks;
}
