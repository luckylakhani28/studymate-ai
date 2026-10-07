const MARKER = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;

/** "[S2] … [S1, S2]" → citations in order of first appearance. Ids the model invented are dropped. */
export function extractCitations(text, sources) {
  const labels = [];
  for (const [, group] of text.matchAll(MARKER)) {
    for (const label of group.split(/\s*,\s*/)) if (!labels.includes(label)) labels.push(label);
  }
  return labels
    .map((label) => ({ label, source: sources[Number(label.slice(1)) - 1] }))
    .filter(({ source }) => source)
    .map(({ label, source }) => ({
      label,
      chunkId: source.chunkId,
      documentId: source.documentId,
      documentTitle: source.documentTitle,
      pageStart: source.pageStart,
      pageEnd: source.pageEnd,
      sectionTitle: source.sectionTitle,
    }));
}

/** Old answers go back to the model as history; their [S1] markers referred to old sources, so remove them. */
export const stripCitations = (text) => text.replace(/\s*\[S\d+(?:\s*,\s*S\d+)*\]/g, '');
