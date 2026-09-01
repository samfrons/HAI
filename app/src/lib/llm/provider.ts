import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

import { budgetFor, budgetTrackingFetch, type TokenBudget } from './rate-limit';

/**
 * The single place HAI decides which model it talks to.
 *
 * Everything goes through an OpenAI-compatible endpoint, which covers local
 * Ollama today and any free hosted endpoint (Groq, Gemini's compatibility
 * layer, OpenRouter) by changing environment variables alone — no code change
 * and no second provider package.
 *
 * cost: $0.00 with the default local Ollama endpoint — inference runs on this
 * machine. A hosted LLM_BASE_URL may bill per token; check before switching.
 */

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_MODEL = 'qwen2.5:14b';
/** Ollama ignores the key but the OpenAI wire format requires one to be present. */
const DEFAULT_API_KEY = 'ollama';

const PROVIDER_NAME = 'hai-llm';

/**
 * The `providerOptions` key for this provider: anything under it that the
 * OpenAI-compatible schema does not recognise is spread verbatim into the
 * request body. It is the camelCase form of PROVIDER_NAME — the SDK accepts the
 * hyphenated name too but warns that it is deprecated.
 */
const PROVIDER_OPTIONS_KEY = 'haiLlm';

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function getLlmConfig(): LlmConfig {
  return {
    baseUrl: process.env.LLM_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    apiKey: process.env.LLM_API_KEY || DEFAULT_API_KEY,
  };
}

/** True when pointed at a local endpoint, i.e. inference is free. */
export function isLocalInference(config: LlmConfig = getLlmConfig()): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(config.baseUrl);
}

export function getChatModel(): LanguageModel {
  return buildModel(getLlmConfig().model);
}

/**
 * The deliverables workflow's own endpoint and model.
 *
 * Defaults to the chat configuration, so a deployment that sets nothing keeps
 * exactly the behaviour it had. What the override buys is capacity, and the
 * reason it is worth having is a measurement rather than a preference: the
 * hosted free tier meters *per model*, on two ceilings at once, and only one of
 * them is visible in headers. Against the deployed key, `qwen/qwen3.8-27b` and
 * `openai/gpt-oss-120b` each reported their own 8,000 tokens a minute and
 * decremented independently — and the wall a live Sudan brief actually hit was
 * the per-day one, 200,000 tokens for that model, already spent by the day's
 * chat traffic before the run began.
 *
 * A brief is roughly twenty thousand tokens. Sharing one 200,000-a-day bucket
 * with chat means the deliverable stops working once somebody has had a busy
 * afternoon in the chat tab, and it fails in the least legible way possible:
 * mid-document, on the model's quota rather than on anything the reader did.
 * Pointing deliverables at a second model gives the two features independent
 * budgets, so a heavy chat day cannot consume the ability to produce a
 * document, and vice versa.
 *
 * `LLM_DELIVERABLES_BASE_URL` and `_API_KEY` are there so the second endpoint
 * can be a different provider entirely rather than a second model on the same
 * one — see docs/DEPLOY.md.
 */
export function getDeliverablesConfig(): LlmConfig {
  const base = getLlmConfig();
  return {
    baseUrl: process.env.LLM_DELIVERABLES_BASE_URL || base.baseUrl,
    model: process.env.LLM_DELIVERABLES_MODEL || base.model,
    apiKey: process.env.LLM_DELIVERABLES_API_KEY || base.apiKey,
  };
}

export function getDeliverablesModel(): LanguageModel {
  const config = getDeliverablesConfig();
  return buildModelFrom(config);
}

/** The token budget for whichever model the deliverables engine is using. */
export function getDeliverablesBudget(): TokenBudget {
  const config = getDeliverablesConfig();
  return budgetFor(budgetKey(config.model, config.baseUrl));
}

/**
 * Extra request-body parameters for the configured endpoint, or undefined.
 *
 * LLM_REASONING_FORMAT exists for one specific and badly-behaved failure. A
 * reasoning model returns its chain of thought as `reasoning_content`; the AI
 * SDK keeps that on the assistant message and sends it back on the next step
 * of a tool loop; and Groq then rejects its own field with "property
 * 'reasoning_content' is unsupported". The result is the worst possible shape
 * of bug for HAI: step one calls search_standards and succeeds, step two — the
 * step that would have turned the retrieved passages into a cited answer —
 * dies, so the user gets a tool spinner and no answer at all.
 *
 * Setting LLM_REASONING_FORMAT=hidden makes the endpoint omit the field
 * entirely, so there is nothing to echo back.
 *
 * LLM_REASONING_EFFORT is the other half of Groq's reasoning controls, for
 * models (the qwen3.x family) that spend output tokens on hidden
 * chain-of-thought before answering. Setting it to `none` skips that
 * reasoning pass. Measured against the deployed default, `qwen/qwen3.8-27b`:
 * identical completion-token counts with and without it on both a tool-call
 * step and a direct answer, i.e. this model was not spending reasoning tokens
 * either way. Wired through anyway, off by default, so switching to a
 * heavier-reasoning model later is one environment variable rather than a
 * code change — see docs/DEPLOY.md.
 *
 * Neither is defaulted on: both parameters are Groq's, and other
 * OpenAI-compatible endpoints reject unknown body fields outright — the
 * deployment that needs one sets it.
 */
export function getProviderOptions(): Record<string, Record<string, string>> | undefined {
  const reasoningFormat = process.env.LLM_REASONING_FORMAT?.trim();
  const reasoningEffort = process.env.LLM_REASONING_EFFORT?.trim();
  if (!reasoningFormat && !reasoningEffort) return undefined;

  return {
    [PROVIDER_OPTIONS_KEY]: {
      ...(reasoningFormat ? { reasoning_format: reasoningFormat } : {}),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    },
  };
}

/**
 * The model used for the optional PII second-pass screen. Defaults to the chat
 * model so the feature works with nothing pulled; set PII_SCREEN_MODEL to a
 * small extraction model (nuextract, qwen2.5:1.5b) to cut the latency the screen
 * adds to every request. Same endpoint either way.
 */
export function getScreeningModel(): LanguageModel {
  const config = getLlmConfig();
  return buildModel(process.env.PII_SCREEN_MODEL || config.model);
}

/**
 * The key a model's token bucket is held under.
 *
 * Endpoint and model, because the buckets are per model: measured against the
 * deployed Groq key, `qwen/qwen3.8-27b` and `openai/gpt-oss-120b` each reported
 * their own 8,000 tokens a minute and decremented independently of one another.
 */
export function budgetKey(
  model: string = getLlmConfig().model,
  baseUrl: string = getLlmConfig().baseUrl,
): string {
  return `${baseUrl}::${model}`;
}

/** The live token budget for the chat/deliverables model. */
export function getModelBudget(model?: string): TokenBudget {
  return budgetFor(budgetKey(model));
}

function buildModel(model: string): LanguageModel {
  return buildModelFrom({ ...getLlmConfig(), model });
}

function buildModelFrom(config: LlmConfig): LanguageModel {
  const { model } = config;

  const provider = createOpenAICompatible({
    name: PROVIDER_NAME,
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    // Every response through this provider updates the model's token budget
    // from the endpoint's own rate-limit headers — see `lib/llm/rate-limit.ts`.
    // Installed here rather than at the call sites so that the spends an engine
    // cannot see (the SDK's internal retries, a concurrent chat turn, the PII
    // screen) are counted too. Those were the ones pushing deliverable runs
    // over the ceiling despite the pacer.
    fetch: budgetTrackingFetch(budgetKey(model, config.baseUrl)),
  });

  return provider.chatModel(model);
}
