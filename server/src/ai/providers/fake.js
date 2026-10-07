/** Scripted provider for tests: enqueue responses or errors, then inspect `calls`. */
export function createFakeProvider() {
  const queue = [];
  const calls = [];

  async function createMessage(params) {
    calls.push(structuredClone(params));
    const next = queue.shift();
    if (!next) throw new Error('FakeProvider: no response queued');
    if (next instanceof Error) throw next;
    const content = next.toolInput
      ? [
          {
            type: 'tool_use',
            id: `toolu_${calls.length}`,
            name: params.tool_choice?.name,
            input: next.toolInput,
          },
        ]
      : [{ type: 'text', text: next.text ?? '' }];
    return {
      model: params.model,
      stopReason: next.stopReason ?? (next.toolInput ? 'tool_use' : 'end_turn'),
      content,
      usage: {
        inputTokens: next.inputTokens ?? 100,
        outputTokens: next.outputTokens ?? 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    };
  }

  return {
    name: 'fake',
    calls,
    enqueue: (...responses) => queue.push(...responses),
    reset: () => {
      queue.length = 0;
      calls.length = 0;
    },
    createMessage,
    async streamMessage(params, { onText } = {}) {
      const res = await createMessage(params);
      for (const block of res.content) {
        if (block.type === 'text')
          for (const piece of block.text.match(/[\s\S]{1,12}/g) ?? []) onText?.(piece);
      }
      return res;
    },
    classifyError: (err) =>
      err.status ? { retryable: err.status === 429 || err.status >= 500 } : null,
  };
}
