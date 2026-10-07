import { env } from '../config/env.js';
import { Conversation, Message, StudyDocument } from '../models/index.js';
import { llm } from '../ai/llm.js';
import { retrieveChunks } from '../ai/retrieval.js';
import { extractCitations, stripCitations } from '../ai/citations.js';
import { estimateTokens } from '../processing/text/chunk.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const HISTORY_MESSAGES = 6; // recent turns sent verbatim
const SUMMARIZE_AFTER = 10; // fold older messages into the rolling summary once this many pile up

export const NOT_FOUND_ANSWER =
  'I couldn’t find this in your selected notes. Try rephrasing the question, or start a conversation that includes the document covering it.';

async function findConversation(userId, id) {
  const conversation = await Conversation.findOwned(id, userId);
  if (!conversation) throw new AppError('NOT_FOUND', { message: 'Conversation not found' });
  return conversation;
}

const titleFrom = (question) =>
  question.length > 60 ? `${question.slice(0, 57).trimEnd()}…` : question;

/** Chat APIs need strictly alternating turns starting with the user. Older answers lose their [S#] markers. */
function toAlternatingTurns(messages) {
  const turns = [];
  for (const m of messages) {
    const turn = {
      role: m.role,
      content: m.role === 'assistant' ? stripCitations(m.content) : m.content,
    };
    if (turns.at(-1)?.role === turn.role) turns[turns.length - 1] = turn;
    else turns.push(turn);
  }
  while (turns[0]?.role === 'assistant') turns.shift();
  if (turns.at(-1)?.role === 'user') turns.pop(); // an unanswered question (e.g. an earlier error)
  return turns;
}

/** Highest-ranked passages that fit the context budget. Never send more than needed. */
function packSources(results, budget) {
  const packed = [];
  let used = 0;
  for (const r of results) {
    const cost = estimateTokens(r.text);
    if (packed.length && used + cost > budget) break;
    packed.push(r);
    used += cost;
  }
  return packed;
}

/** Retrieval + relevance gate + context packing. Shared by chat and by eval:qa. */
export async function buildContext({
  userId,
  documentIds,
  query,
  budget = env.QA_CONTEXT_TOKENS,
  minScore = env.QA_MIN_SCORE,
}) {
  const { results } = await retrieveChunks({ userId, documentIds, query, limit: 8 });
  const bestScore = Math.max(0, ...results.map((r) => r.vectorScore ?? 0));
  const grounded = bestScore >= minScore;
  return { grounded, bestScore, sources: grounded ? packSources(results, budget) : [] };
}

export async function createConversation(userId, { documentIds, title }) {
  const unique = [...new Set(documentIds)];
  const docs = await StudyDocument.find({ _id: { $in: unique }, userId, status: 'ready' }, '_id');
  if (docs.length !== unique.length) {
    throw new AppError('DOCUMENT_NOT_READY', {
      message: 'Choose documents that have finished processing.',
    });
  }
  return Conversation.create({
    userId,
    documentIds: docs.map((d) => d._id),
    ...(title && { title }),
  });
}

export async function listConversations(userId, { page, limit }) {
  const [conversations, total] = await Promise.all([
    Conversation.find({ userId })
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Conversation.countDocuments({ userId }),
  ]);
  return { conversations, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getConversation(userId, id, { before, limit }) {
  const conversation = await findConversation(userId, id);
  const page = await Message.find({
    conversationId: conversation._id,
    ...(before && { _id: { $lt: before } }),
  })
    .sort({ _id: -1 })
    .limit(limit + 1);
  return { conversation, messages: page.slice(0, limit).reverse(), hasMore: page.length > limit };
}

export async function renameConversation(userId, id, title) {
  const conversation = await findConversation(userId, id);
  conversation.title = title;
  return conversation.save();
}

export async function deleteConversation(userId, id) {
  const conversation = await findConversation(userId, id);
  await Promise.all([
    conversation.deleteOne(),
    Message.deleteMany({ conversationId: conversation._id }),
  ]);
}

/**
 * Everything that can fail cheaply happens here, BEFORE the response starts streaming,
 * so failures are still ordinary JSON errors with proper status codes.
 */
export async function prepareTurn(userId, conversationId, question) {
  const conversation = await findConversation(userId, conversationId);
  if (conversation.documentIds.length === 0) {
    throw new AppError('DOCUMENT_NOT_READY', {
      message: 'This conversation has no documents left. Start a new one.',
    });
  }

  const recent = await Message.find({ conversationId: conversation._id, status: 'complete' })
    .sort({ _id: -1 })
    .limit(HISTORY_MESSAGES)
    .lean();
  const history = toAlternatingTurns(recent.reverse());
  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId,
    role: 'user',
    content: question,
  });

  // "Why is it fast?" retrieves nothing useful; "Why is the TLB fast?" does.
  let query = question;
  if (history.length) {
    try {
      ({
        data: { query },
      } = await llm.runPrompt(
        'query_rewrite',
        { history, question },
        { userId, feature: 'qa_rewrite' },
      ));
    } catch (err) {
      logger.warn({ err }, 'Query rewrite failed; searching with the original question');
    }
  }

  const { grounded, sources } = await buildContext({
    userId,
    documentIds: conversation.documentIds,
    query,
  });
  return { conversation, userMessage, history, question, grounded, sources };
}

/** Streams the answer via onText, then saves it: complete, stopped (user pressed Stop), or error. */
export async function streamAnswer(ctx, { onText, signal }) {
  const { conversation, history, question, grounded, sources } = ctx;
  let text = '';
  let failure = null;

  try {
    if (!grounded) {
      text = NOT_FOUND_ANSWER; // no relevant passages, so no LLM call and no tokens spent
      onText(text);
    } else {
      await llm.streamPrompt(
        'qa',
        { history, summary: conversation.rollingSummary, sources, question },
        {
          userId: conversation.userId,
          feature: 'qa',
          signal,
          onText: (delta) => {
            text += delta;
            onText(delta);
          },
        },
      );
    }
  } catch (err) {
    failure = err;
  }

  const stopped = Boolean(failure && signal?.aborted);
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: conversation.userId,
    role: 'assistant',
    content: text,
    citations: grounded ? extractCitations(text, sources) : [],
    grounded,
    status: failure ? (stopped ? 'stopped' : 'error') : 'complete',
    errorCode: failure ? (stopped ? 'CANCELLED' : (failure.code ?? 'INTERNAL_ERROR')) : undefined,
  });

  const isFirstTurn = conversation.messageCount === 0 && conversation.title === 'New conversation';
  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $inc: { messageCount: 2 },
      $set: { lastMessageAt: new Date(), ...(isFirstTurn && { title: titleFrom(question) }) },
    },
  );

  if (!failure) void maybeSummarize(conversation._id); // off the response path
  if (failure && !stopped) throw failure;
  return assistantMessage;
}

/** Keeps long chats affordable: old turns become a short summary instead of growing the prompt forever. */
async function maybeSummarize(conversationId) {
  try {
    const conv = await Conversation.findById(conversationId);
    const total = await Message.countDocuments({ conversationId, status: 'complete' });
    const toFold = total - HISTORY_MESSAGES - conv.summarizedCount;
    if (toFold < SUMMARIZE_AFTER) return;

    const older = await Message.find({ conversationId, status: 'complete' })
      .sort({ _id: 1 })
      .skip(conv.summarizedCount)
      .limit(toFold)
      .lean();
    const { text } = await llm.runPrompt(
      'conversation_summary',
      {
        previousSummary: conv.rollingSummary,
        messages: older.map((m) => ({ role: m.role, content: stripCitations(m.content) })),
      },
      { userId: conv.userId, feature: 'qa_summary' },
    );
    // Guarded on summarizedCount: if two folds race, only one applies.
    await Conversation.updateOne(
      { _id: conversationId, summarizedCount: conv.summarizedCount },
      { $set: { rollingSummary: text.trim() }, $inc: { summarizedCount: older.length } },
    );
  } catch (err) {
    logger.warn({ err, conversationId }, 'Conversation summary failed');
  }
}
