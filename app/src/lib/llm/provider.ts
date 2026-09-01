import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

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

function buildModel(model: string): LanguageModel {
  const config = getLlmConfig();

  const provider = createOpenAICompatible({
    name: PROVIDER_NAME,
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  return provider.chatModel(model);
}
