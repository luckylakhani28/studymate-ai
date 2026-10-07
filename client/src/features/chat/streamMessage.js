import { getAccessToken, refreshSession } from '../../api/client.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const post = (conversationId, content, signal) =>
  fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ content }),
  });

/**
 * POST + Server-Sent Events. EventSource can't send a body or an Authorization header, so the stream
 * is read with fetch. It bypasses the Axios interceptor, so it retries a 401 once itself.
 */
export async function streamMessage(conversationId, content, { signal, onEvent }) {
  let res = await post(conversationId, content, signal);
  if (res.status === 401) {
    await refreshSession();
    res = await post(conversationId, content, signal);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw Object.assign(new Error(body?.error?.message ?? 'The request failed.'), {
      code: body?.error?.code,
    });
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}
