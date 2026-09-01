/**
 * Keeping a multi-step workflow inside the endpoint's tokens-per-minute
 * ceiling, and surviving it when the estimate is wrong.
 *
 * Chat gets away without this. One turn is a handful of calls and a person
 * typing between them, so the rate limit is never the binding constraint. A
 * deliverable is different in kind: the situation brief is six sections and
 * roughly eighteen model calls fired back to back with no human in the loop.
 * Against the deployed hosted configuration — Groq's free tier, 8,000 tokens a
 * minute — that sequence will exhaust a minute's budget somewhere in section
 * two and then fail, and it fails in the worst way: half a document, the trace
 * stopped mid-tick, and a 429 the user cannot act on.
 *
 * So the engine paces itself. Before each call it declares an estimated cost;
 * the pacer holds it until the trailing minute has room. The wait is real time
 * the user spends watching the trace panel rather than an error page, which is
 * the trade this whole feature is built around — a brief that takes three
 * minutes and is auditable beats one that takes forty seconds and is not.
 *
 * None of this applies to local inference, where the ceiling does not exist:
 * `isLocalInference()` disables pacing entirely rather than slowing the
 * development loop down to imitate a limit that is not there.
 */

import { getLlmConfig, isLocalInference } from '@/lib/llm/provider';

/**
 * Groq's free tier at the time of writing. Configurable because it is the one
 * number here that is a property of somebody else's billing page rather than of
 * this code — a paid tier or a different endpoint moves it, and nothing else
 * needs to change.
 */
const DEFAULT_TOKENS_PER_MINUTE = 8_000;
const WINDOW_MS = 60_000;

/**
 * Characters per token. Deliberately pessimistic: the real ratio for English
 * prose is nearer 4, and the cost of over-estimating is a few seconds of extra
 * pacing, while the cost of under-estimating is the 429 this exists to avoid.
 */
const CHARS_PER_TOKEN = 3.5;

/** What a call is assumed to produce when nothing better is known. */
const DEFAULT_OUTPUT_TOKENS = 500;

/**
 * A registered tool's description and JSON schema, as sent on every request.
 *
 * HAI's tool descriptions are long on purpose — they carry the grounding policy
 * ("Mandatory before stating any caseload…") that keeps the model calling them.
 * That prose is not free: it is re-sent with every step of a tool loop, for
 * every tool in the subset, and measured against the deployed set it runs to
 * roughly this per tool.
 */
const TOOL_SCHEMA_TOKENS = 320;

/** What one tool result adds to the context it is returned into. */
const TOOL_RESULT_TOKENS = 500;

/**
 * Tool calls assumed per step.
 *
 * Not one. Whether the model may fan out within a single step is decided by
 * `parallel_tool_calls` in `lib/llm/provider.ts`, which is a deployment
 * concern rather than this file's — and on the live Sudan run the needs
 * section issued three calls in one step. Budgeting for one would put the
 * pacer back where it was: confident, low, and wrong in the direction that
 * ends in a 429.
 */
const RESULTS_PER_STEP = 2;

/**
 * What a tool-calling loop of `steps` steps costs, beyond its prompt.
 *
 * The term that matters is the accumulation, and getting it wrong is what put a
 * live Sudan brief over Groq's ceiling despite the pacer. Every tool result
 * rides along in every *subsequent* request of the same loop, so three steps do
 * not cost three results — they cost one, then two, then three, i.e. six. The
 * first implementation reserved a flat per-call figure, under-estimated a
 * three-step gather by about a factor of three, and let enough calls through in
 * one minute for the endpoint to refuse one.
 */
export function estimateToolLoopTokens(
  toolCount: number,
  steps: number,
  outputPerStep = 250,
): number {
  const schemas = toolCount * TOOL_SCHEMA_TOKENS * steps;
  const accumulated = ((steps * (steps + 1)) / 2) * TOOL_RESULT_TOKENS * RESULTS_PER_STEP;
  return schemas + accumulated + steps * outputPerStep;
}

export function tokensPerMinute(): number {
  const parsed = Number.parseInt(process.env.LLM_TOKENS_PER_MINUTE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOKENS_PER_MINUTE;
}

/** Rough token count for a prompt, from its character length. */
export function estimateTokens(text: string, expectedOutput = DEFAULT_OUTPUT_TOKENS): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN) + expectedOutput;
}

interface Spend {
  at: number;
  tokens: number;
}

/**
 * A sliding-window budget over one endpoint.
 *
 * Held per run rather than per process: two people generating briefs at once on
 * the same deployment do share the real quota, but a shared pacer would make
 * each wait on the other's spending with no way to tell them why. The daily cap
 * in `lib/limits` is what actually bounds concurrent use; this bounds one run.
 */
export class TokenPacer {
  private readonly spends: Spend[] = [];
  private readonly limit: number;
  private readonly enabled: boolean;

  constructor(limit = tokensPerMinute(), enabled = !isLocalInference(getLlmConfig())) {
    this.limit = limit;
    this.enabled = enabled;
  }

  private trim(now: number): void {
    const cutoff = now - WINDOW_MS;
    while (this.spends.length > 0 && this.spends[0].at <= cutoff) this.spends.shift();
  }

  private used(now: number): number {
    this.trim(now);
    return this.spends.reduce((total, spend) => total + spend.tokens, 0);
  }

  /**
   * Milliseconds to wait before spending `tokens`, or 0. Exposed separately
   * from `reserve` so tests can assert the arithmetic without sleeping and so
   * the engine can report a long wait in the trace rather than going silent.
   */
  waitFor(tokens: number, now = Date.now()): number {
    if (!this.enabled) return 0;
    if (this.used(now) + tokens <= this.limit) return 0;

    // Wait until enough of the oldest spending has aged out of the window.
    let freed = 0;
    const needed = this.used(now) + tokens - this.limit;
    for (const spend of this.spends) {
      freed += spend.tokens;
      if (freed >= needed) return Math.max(0, spend.at + WINDOW_MS - now);
    }
    // A single call larger than the whole budget: nothing to wait for, let it
    // through and let the endpoint decide. Pacing cannot fix a call that does
    // not fit, and stalling forever is worse than a clear upstream error.
    return 0;
  }

  /** Wait if needed, then record the spend. */
  async reserve(tokens: number): Promise<void> {
    if (!this.enabled) return;
    const wait = this.waitFor(tokens);
    if (wait > 0) await sleep(wait);
    this.spends.push({ at: Date.now(), tokens });
  }

  /**
   * Correct a reservation once real usage is known. Estimates run high on
   * purpose (see `CHARS_PER_TOKEN`), so without this the pacer would slow a run
   * down by whatever margin it built in.
   */
  settle(estimated: number, actual: number): void {
    if (!this.enabled || this.spends.length === 0) return;
    const last = this.spends[this.spends.length - 1];
    if (last.tokens !== estimated) return;
    last.tokens = Math.max(0, actual);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether an error is the endpoint saying "too fast" rather than "wrong".
 * Matched on text because the OpenAI-compatible provider surfaces upstream
 * 429s as errors whose useful detail is in the message, and because a rate
 * limit retried once is recoverable while a 400 retried once is just slower.
 */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { statusCode?: number; status?: number }).statusCode ??
      (error as { status?: number }).status;
    if (status === 429) return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /429|rate.?limit|too many requests|tokens per min/i.test(message);
}

/**
 * Retry a model call through a rate limit, and only through a rate limit.
 *
 * Two attempts, not more. A workflow that keeps retrying turns one slow section
 * into a run that never visibly finishes, and the engine's own fallback — mark
 * the step degraded, say so in the trace, keep the document going — is a better
 * outcome for the reader than a longer silence.
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  onWait?: (ms: number) => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRateLimitError(error)) throw error;
    const wait = retryAfterMs(error) ?? 20_000;
    onWait?.(wait);
    await sleep(wait);
    return operation();
  }
}

/** The endpoint's own `retry-after`, when it sent one, capped at 45s. */
function retryAfterMs(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const match = /try again in ([\d.]+)\s*(ms|s|m)\b/i.exec(message);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = match[2].toLowerCase();
  const ms = unit === 'ms' ? value : unit === 'm' ? value * 60_000 : value * 1_000;
  return Math.min(45_000, Math.ceil(ms) + 500);
}
