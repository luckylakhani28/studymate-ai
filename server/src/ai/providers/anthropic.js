import Anthropic from '@anthropic-ai/sdk';

const normalize = (res) => ({
  model: res.model,
  stopReason: res.stop_reason,
  content: res.content,
  usage: {
    inputTokens: res.usage.input_tokens ?? 0,
    outputTokens: res.usage.output_tokens ?? 0,
    cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
  },
});

export function createAnthropicProvider({ apiKey, timeoutMs, maxRetries }) {
  // The SDK retries 429, 5xx, 529 (overloaded) and connection errors with exponential backoff.
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries });

  return {
    name: 'anthropic',

    createMessage: async (params, { signal } = {}) =>
      normalize(await client.messages.create(params, { signal })),

    async streamMessage(params, { signal, onText } = {}) {
      const stream = client.messages.stream(params, { signal });
      stream.on('text', (delta) => onText?.(delta));
      return normalize(await stream.finalMessage());
    },

    /** null means "not a provider failure": aborts and our own bugs pass through unchanged. */
    classifyError(err) {
      if (err instanceof Anthropic.APIUserAbortError) return null;
      if (err instanceof Anthropic.APIConnectionError) return { retryable: true }; // includes timeouts
      if (err instanceof Anthropic.APIError) {
        const s = err.status;
        if (s === 429 || s === 529 || s >= 500) return { retryable: true };
        if (s === 401 || s === 403) return { retryable: false, misconfigured: true };
        return { retryable: false }; // 400: our request is malformed, so retrying won't help
      }
      return null;
    },
  };
}
