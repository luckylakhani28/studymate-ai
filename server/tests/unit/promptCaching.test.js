import { describe, it, expect } from 'vitest';
import { getPrompt } from '../../src/ai/prompts/registry.js';

describe('prompt caching', () => {
  it('marks the sources block cacheable only where the prefix is likely to be re-sent', () => {
    const input = {
      documentTitle: 'OS',
      passages: [{ text: 'x', pageStart: 1, pageEnd: 1 }],
      count: 5,
      difficulty: 'mixed',
    };
    expect(getPrompt('quiz').buildMessages(input)[0].content[0].cache_control).toEqual({
      type: 'ephemeral',
    });
    expect(
      getPrompt('document_summary').buildMessages(input)[0].content[0].cache_control,
    ).toBeUndefined();
  });
});
