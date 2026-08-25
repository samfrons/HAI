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
    name: 'hai-llm',
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  return provider.chatModel(model);
}
