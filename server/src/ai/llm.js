import { env } from '../config/env.js';
import { AiUsage } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { assertWithinQuota } from '../services/usage.service.js';
import { getPrompt } from './prompts/registry.js';
import { costUsd, quotaTokens } from './pricing.js';
import { createAnthropicProvider } from './providers/anthropic.js';
import { createFakeProvider } from './providers/fake.js';

const TOOL_NAME = 'submit_result';
const MODELS = { fast: env.AI_MODEL_FAST, smart: env.AI_MODEL_SMART };
const EMPTY_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

function totalUsage(calls) {
  const sum = { ...EMPTY_USAGE, costUsd: 0, calls: calls.length };
  for (const { model, usage } of calls) {
    for (const key of Object.keys(EMPTY_USAGE)) sum[key] += usage[key];
    sum.costUsd += costUsd(model, usage);
  }
  return sum;
}

function validateOutput(prompt, raw, input) {
  const parsed = prompt.output.safeParse(raw);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues
        .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n'),
    };
  }
  const semantic = prompt.check?.(parsed.data, input);
  return semantic ? { problems: `- ${semantic}` } : { data: parsed.data };
}

/** The single gateway every AI feature goes through: routing, metering, quotas, validation, errors. */
export function createLlm({ provider }) {
  function toAppError(err) {
    if (err instanceof AppError) return err;
    const kind = provider.classifyError?.(err);
    if (!kind) return err; // aborts and programming errors stay as they are
    if (kind.misconfigured)
      logger.error('LLM provider rejected our credentials: check ANTHROPIC_API_KEY');
    else if (!kind.retryable) logger.error({ err }, 'LLM provider rejected the request');
    // `retryable` tells the job runner whether a background job should try again later.
    return Object.assign(new AppError('LLM_UNAVAILABLE', { cause: err }), {
      retryable: kind.retryable,
    });
  }

  async function recordUsage(model, usage, latencyMs, error, meta) {
    try {
      await AiUsage.create({
        userId: meta.userId,
        feature: meta.feature,
        promptId: meta.prompt.id,
        promptVersion: meta.prompt.version,
        model,
        ...usage,
        quotaTokens: quotaTokens(usage),
        costUsd: costUsd(model, usage),
        latencyMs,
        status: error ? 'error' : 'ok',
        errorCode: error?.code,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to record AI usage'); // metering must never break the feature
    }
  }

  /** One API call, always metered, including failures. */
  async function call(params, meta, invoke = provider.createMessage) {
    const started = Date.now();
    let res;
    let error;
    try {
      res = await invoke(params, { signal: meta.signal });
      return res;
    } catch (err) {
      error = toAppError(err);
      throw error;
    } finally {
      await recordUsage(params.model, res?.usage ?? EMPTY_USAGE, Date.now() - started, error, meta);
    }
  }

  const buildParams = (prompt, input, model) => ({
    model: model ?? MODELS[prompt.tier],
    max_tokens: prompt.maxTokens,
    system: prompt.system,
    messages: prompt.buildMessages(input),
    ...(prompt.temperature !== undefined && { temperature: prompt.temperature }),
  });

  const textOf = (res) =>
    res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

  async function runText(params, meta) {
    const res = await call(params, meta);
    return {
      text: textOf(res),
      truncated: res.stopReason === 'max_tokens',
      usage: totalUsage([{ model: params.model, usage: res.usage }]),
    };
  }

  /**
   * Forced tool use: the model must call `submit_result`, whose input schema is the prompt's zod schema.
   * Invalid output gets ONE repair turn with the exact validation errors; after that we fail.
   */
  async function runStructured(prompt, input, base, meta) {
    const tool = {
      name: TOOL_NAME,
      description: 'Submit the final result.',
      input_schema: prompt.inputSchema,
    };
    const calls = [];
    let messages = base.messages;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const params = {
        ...base,
        messages,
        tools: [tool],
        tool_choice: { type: 'tool', name: TOOL_NAME },
      };
      const res = await call(params, meta);
      calls.push({ model: params.model, usage: res.usage });

      // A truncated tool call is incomplete JSON; a repair turn with the same budget would truncate too.
      if (res.stopReason === 'max_tokens') throw new AppError('AI_OUTPUT_TRUNCATED');

      const block = res.content.find((b) => b.type === 'tool_use');
      const { data, problems } = validateOutput(prompt, block?.input, input);
      if (data) return { data, attempts: attempt, usage: totalUsage(calls) };

      if (attempt === 2) {
        logger.warn(
          { prompt: prompt.id, version: prompt.version, problems },
          'AI output invalid after repair',
        );
        throw new AppError('AI_OUTPUT_INVALID');
      }

      const feedback = `Your output was invalid:\n${problems}\nCall ${TOOL_NAME} again with corrected input.`;
      messages = [
        ...messages,
        { role: 'assistant', content: res.content },
        {
          role: 'user',
          content: block
            ? [{ type: 'tool_result', tool_use_id: block.id, is_error: true, content: feedback }]
            : feedback,
        },
      ];
    }
    throw new Error('unreachable');
  }

  /**
   * The one entry point for every AI feature.
   * `model` overrides the prompt's tier (used by evaluations).
   */
  async function runPrompt(promptId, input, { userId, feature, signal, version, model } = {}) {
    const prompt = getPrompt(promptId, version);
    // Reserve the output budget before spending anything.
    await assertWithinQuota(userId, prompt.maxTokens);

    const meta = { userId, feature: feature ?? prompt.id, prompt, signal };
    const params = buildParams(prompt, input, model);
    return prompt.output ? runStructured(prompt, input, params, meta) : runText(params, meta);
  }

  /** Free-text prompts only: streams text deltas to onText while metering exactly like runPrompt. */
  async function streamPrompt(
    promptId,
    input,
    { userId, feature, signal, onText, version, model } = {},
  ) {
    const prompt = getPrompt(promptId, version);
    if (prompt.output) throw new Error(`Prompt ${promptId} is structured and can't be streamed`);
    await assertWithinQuota(userId, prompt.maxTokens);

    const meta = { userId, feature: feature ?? prompt.id, prompt, signal };
    const params = buildParams(prompt, input, model);
    const res = await call(params, meta, (p, opts) =>
      provider.streamMessage(p, { ...opts, onText }),
    );
    return {
      text: textOf(res),
      truncated: res.stopReason === 'max_tokens',
      usage: totalUsage([{ model: params.model, usage: res.usage }]),
    };
  }

  return { runPrompt, streamPrompt };
}

const defaultProvider =
  env.AI_PROVIDER === 'anthropic'
    ? createAnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        timeoutMs: env.AI_TIMEOUT_MS,
        maxRetries: env.AI_MAX_RETRIES,
      })
    : createFakeProvider();

/** Exported so tests can script the fake provider. */
export const provider = defaultProvider;
export const llm = createLlm({ provider: defaultProvider });
