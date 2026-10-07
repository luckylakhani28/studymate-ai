import * as chatService from '../services/chat.service.js';
import { ok, created, noContent } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';

export async function create(req, res) {
  created(res, {
    conversation: await chatService.createConversation(req.user.id, req.validated.body),
  });
}

export async function list(req, res) {
  const { conversations, meta } = await chatService.listConversations(
    req.user.id,
    req.validated.query,
  );
  ok(res, { conversations }, { meta });
}

export async function get(req, res) {
  const { params, query } = req.validated;
  ok(res, await chatService.getConversation(req.user.id, params.id, query));
}

export async function rename(req, res) {
  const { params, body } = req.validated;
  ok(res, {
    conversation: await chatService.renameConversation(req.user.id, params.id, body.title),
  });
}

export async function remove(req, res) {
  await chatService.deleteConversation(req.user.id, req.validated.params.id);
  noContent(res);
}

const publicSource = (s, i) => ({
  label: `S${i + 1}`,
  documentId: s.documentId,
  documentTitle: s.documentTitle,
  pageStart: s.pageStart,
  pageEnd: s.pageEnd,
  sectionTitle: s.sectionTitle,
});

/** Server-Sent Events: start → token* → done | error. */
export async function sendMessage(req, res) {
  const { params, body } = req.validated;
  const ctx = await chatService.prepareTurn(req.user.id, params.id, body.content); // failures here are normal JSON errors

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop reverse proxies (nginx) from buffering the stream
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // The browser closed the tab or pressed Stop. (req 'close' fires once the body is read, so listen on res.)
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  send('start', {
    userMessage: ctx.userMessage,
    grounded: ctx.grounded,
    sources: ctx.sources.map(publicSource),
  });
  try {
    const assistantMessage = await chatService.streamAnswer(ctx, {
      signal: controller.signal,
      onText: (text) => send('token', { text }),
    });
    send('done', { assistantMessage });
  } catch (err) {
    req.log.error({ err }, 'Answer stream failed');
    send('error', {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err instanceof AppError ? err.message : 'Something went wrong while answering.',
    });
  } finally {
    res.end();
  }
}
