import { z } from 'zod';

const REQUIRED = ['id', 'version', 'tier', 'maxTokens', 'system', 'buildMessages'];
const TIERS = new Set(['fast', 'smart']);

/**
 * A prompt is data plus two functions:
 *   buildMessages(input)  → messages for the API
 *   check(output, input)  → optional semantic validation beyond the schema; returns an error string or null
 * If `output` (a zod schema) is present, the model is forced to return JSON matching it.
 */
export function definePrompt(def) {
  for (const key of REQUIRED) {
    if (def[key] === undefined) throw new Error(`Prompt ${def.id ?? '?'} is missing "${key}"`);
  }
  if (!TIERS.has(def.tier)) throw new Error(`Prompt ${def.id}: unknown tier "${def.tier}"`);

  let inputSchema;
  if (def.output) {
    inputSchema = z.toJSONSchema(def.output);
    delete inputSchema.$schema;
  }
  return Object.freeze({ ...def, inputSchema });
}
