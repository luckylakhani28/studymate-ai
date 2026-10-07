import { z } from 'zod';
import { definePrompt } from './definePrompt.js';
import { GROUNDING_RULES, checkCitedSources, formatSources } from './shared.js';

/** An output item that must cite the sources supporting it. */
export const sourced = (fields) =>
  z.strictObject({
    ...fields,
    sources: z.array(z.string()).min(1).describe('Ids of the supporting sources, e.g. ["S2"]'),
  });

/**
 * Turns a document digest (sources S1..Sn) into study material, with shared grounding and citation checks.
 * `cacheSources` marks the sources block as a prompt-cache breakpoint: worth it only where the same
 * prefix is re-sent (regenerations, repair turns), because cache writes cost 25% extra.
 */
export function defineStudyPrompt({ task, items, maxItems, cacheSources = false, ...def }) {
  return definePrompt({
    ...def,
    system: `You create study material for a student from their own course documents.\n${GROUNDING_RULES}`,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: formatSources(input.passages, { documentTitle: input.documentTitle }),
            ...(cacheSources && { cache_control: { type: 'ephemeral' } }),
          },
          {
            type: 'text',
            text: `${typeof task === 'function' ? task(input) : task}\nCite the source ids that support each item.`,
          },
        ],
      },
    ],
    check: (data, input) => {
      const list = items(data);
      const max = maxItems?.(input);
      if (max && list.length > max)
        return `Return at most ${max} items; you returned ${list.length}.`;
      return checkCitedSources(
        list.flatMap((item) => item.sources),
        input.passages,
      );
    },
  });
}
