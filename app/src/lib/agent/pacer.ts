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
 * So the engine paces itself. Before each call it projects a cost; the pacer
 * holds it until the endpoint has room. The wait is real time the user spends
 * watching the trace panel rather than an error page, which is the trade this
 * whole feature is built around — a brief that takes three minutes and is
 * auditable beats one that takes forty seconds and is not.
 *
 * # What changed, and why the first version was not enough
 *
 * This file used to be the whole accountant: a per-run sliding window of
 * *estimated* spends, enabled by checking whether the base URL looked local.
 * Both halves were wrong in production.
 *
 * The estimates were wrong because the quantity that matters is not knowable
 * from the prompt string — the SDK adds tool schemas, accumulated tool results
 * and its own internal retries on the way out, and a hosted brief spent well
 * over what the arithmetic here predicted. The window was wrong because it was
 * per run, while the quota is per account: a chat turn arriving mid-brief, or a
 * second brief, spent from a bucket this pacer did not know existed.
 *
 * Both are now read from the endpoint's own rate-limit headers on every
 * response — see `lib/llm/rate-limit.ts`. What is left in this file is the
 * projection (how much is this next call likely to cost, so we can ask whether
 * it fits) and the headroom policy. The `isLocalInference()` check is gone with
 * them: an endpoint that never claims a ceiling is never paced, which covers
 * local Ollama without naming it.
 */

import { getModelBudget } from '@/lib/llm/provider';
import { RATE_LIMITED, parseRateLimitError, type TokenBudget } from '@/lib/llm/rate-limit';

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

/**
 * `LLM_TOKENS_PER_MINUTE`, when a deployment sets one.
 *
 * Undefined is now the normal case rather than a fallback to a hard-coded 8,000:
 * the endpoint reports its own ceiling on every response, so a paid tier or a
 * different provider is paced correctly with no configuration. This is for the
 * endpoint that meters silently — see `TokenBudget.declareLimit`.
 */
export function declaredTokensPerMinute(): number | undefined {
  const parsed = Number.parseInt(process.env.LLM_TOKENS_PER_MINUTE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Rough token count for a prompt, from its character length. */
export function estimateTokens(text: string, expectedOutput = DEFAULT_OUTPUT_TOKENS): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN) + expectedOutput;
}

/**
 * Headroom kept below the endpoint's stated ceiling.
 *
 * The budget is read from headers that describe the moment a response was
 * written, and by the time we act on it another request may already be in
 * flight. Aiming at 100% of the bucket means every mis-timing is a 429; aiming
 * at 85% costs a few seconds a run and makes the ceiling a wall we stop short
 * of rather than one we discover by hitting it.
 */
const SAFETY_FRACTION = 0.85;

/**
 * The pacer, now a thin policy layer over a measured budget.
 *
 * Everything that used to live here — a per-run sliding window of estimated
 * spends, an enabled flag derived from the base URL — is gone, because it was
 * modelling something the endpoint reports directly. What remains is the two
 * decisions that are genuinely ours: how much headroom to leave under the
 * stated ceiling, and how to project the cost of a call that has not been made
 * yet. See `lib/llm/rate-limit.ts` for why the reading is authoritative.
 *
 * The budget is shared per process and per model rather than per run. That is a
 * deliberate reversal: two runs on one instance really do take from the same
 * quota, and a pacer that gave each its own imaginary window was how a second
 * request pushed the first into a 429 it had already paced around.
 */
export class TokenPacer {
  private readonly budget: TokenBudget;

  /**
   * Tests inject a budget; production takes the shared one for the configured
   * model. A `LLM_TOKENS_PER_MINUTE` override is declared onto the budget
   * rather than held here, so that everything reading the budget — the engine's
   * trace, the chat route's queue notice — sees one consistent ceiling.
   */
  constructor(budget: TokenBudget = getModelBudget()) {
    this.budget = budget;
    const declared = declaredTokensPerMinute();
    if (declared !== undefined) this.budget.declareLimit(declared);
  }

  /** Whether the endpoint has claimed a ceiling this pacer must respect. */
  get isPacing(): boolean {
    return this.budget.isMeasured;
  }

  /**
   * How long the endpoint's per-day ceiling stays shut, or 0.
   *
   * Kept separate from `waitFor` because the caller must be able to act
   * differently: a per-minute wait is paced through, a per-day one is reported
   * and the run stops. Folding them together is what let a run spend twelve
   * minutes retrying into a limit that resets tomorrow.
   */
  dailyBlockMs(now = Date.now()): number {
    return this.budget.dailyBlockFor(now);
  }

  snapshot() {
    return this.budget.snapshot();
  }

  /**
   * Milliseconds to wait before spending `tokens`, or 0. Exposed separately
   * from `reserve` so the engine can announce a long wait in the trace before
   * going quiet for it, and so tests can assert the arithmetic without sleeping.
   */
  waitFor(tokens: number, now = Date.now()): number {
    return this.budget.waitFor(tokens / SAFETY_FRACTION, now);
  }

  /** Wait if needed, then record the spend against the in-flight ledger. */
  async reserve(tokens: number): Promise<void> {
    const wait = this.waitFor(tokens);
    if (wait > 0) await sleep(wait);
    this.budget.debit(tokens);
  }

  /**
   * Correct a reservation once real usage is known.
   *
   * Mostly a no-op now, and deliberately so: the response that carried the
   * usage also carried `x-ratelimit-remaining-tokens`, which the provider's
   * fetch has already folded in as ground truth. This only matters for an
   * endpoint that meters but does not say so in headers, where the estimate
   * remains the only ledger there is.
   */
  settle(estimated: number, actual: number): void {
    if (!this.budget.isMeasured) return;
    const correction = actual - estimated;
    if (correction > 0) this.budget.debit(correction);
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
  return RATE_LIMITED.test(message);
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
    // A daily ceiling is not something to retry into. The retry that used to
    // happen here waited out a capped 45 seconds against a limit whose own
    // message said "try again in 17m31s", burned a request doing it, and failed
    // again — which is how a single exhausted quota turned into a run that
    // looked hung for twelve minutes before dying.
    if (isDailyLimit(error)) throw error;
    const wait = retryAfterMs(error) ?? 20_000;
    onWait?.(wait);
    await sleep(wait);
    return operation();
  }
}

/** Whether a refusal was about the per-day ceiling rather than the per-minute one. */
export function isDailyLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return parseRateLimitError(message).scope === 'tokens-per-day';
}

/** The endpoint's own `retry-after`, when it sent one, capped at 45s. */
function retryAfterMs(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const parsed = parseRateLimitError(message).retryAfterMs;
  if (parsed === undefined) return undefined;
  return Math.min(45_000, parsed + 500);
}
