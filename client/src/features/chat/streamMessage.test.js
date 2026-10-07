// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamMessage } from './streamMessage.js';

afterEach(() => vi.unstubAllGlobals());

describe('streamMessage', () => {
  it('parses SSE events even when a network chunk splits an event in half', async () => {
    const pieces = [
      'event: start\ndata: {"grounded":true}\n\nevent: tok',
      'en\ndata: {"text":"Hel"}\n\nevent: token\ndata: {"text":"lo"}\n\nevent: done\ndata: {}\n\n',
    ];
    const body = new ReadableStream({
      start(controller) {
        for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    );

    const events = [];
    await streamMessage('c1', 'hi', { onEvent: (event, data) => events.push([event, data]) });

    expect(events).toEqual([
      ['start', { grounded: true }],
      ['token', { text: 'Hel' }],
      ['token', { text: 'lo' }],
      ['done', {}],
    ]);
  });
});
