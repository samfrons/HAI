/**
 * What the endpoint says is left, rather than what we guessed we spent.
 *
 * The pacer in `lib/agent/pacer.ts` was built to keep a deliverable inside
 * Groq's free-tier ceiling by estimating each call's cost from its prompt
 * length. That is the only thing you can do before the first call, and it is
 * wrong in both directions for the same reason: the number that matters is
 * prompt + completion + every tool schema and tool result the SDK adds on the
 * way out, and none of those are visible from the string the engine holds. On
 * the live Sudan brief the estimate ran under by enough that section one
 * exhausted the minute's budget on its own, and the endpoint's `retry-after`
 * then climbed past twelve minutes because each rejected attempt still counted
 * against the window.
 *
 * Groq — and every OpenAI-compatible endpoint worth deploying against — already
 * answers the question exactly, on every single response:
 *
 *     x-ratelimit-limit-tokens: 8000
 *     x-ratelimit-remaining-tokens: 7982
 *     x-ratelimit-reset-tokens: 7.66s
 *
 * That is ground truth about a bucket this process does not exclusively own: it
 * counts the eval running in another terminal, the chat request that arrived
 * while a brief was drafting, and the SDK's own internal retries, none of which
 * a per-run estimate can see. So the budget is read from the wire and the
 * estimate is demoted to what it is good for — projecting the cost of the call
 * about to be made, so we can tell whether it fits.
 *
 * # The refill model
 *
 * Groq meters tokens as a continuously refilling bucket rather than a stepped
 * window: `reset-tokens` is the time until *full*, and capacity comes back
 * smoothly in between. So the wait for a call that does not fit right now is
 * solvable in closed form instead of being a poll — see `waitFor`. Treating it
 * as a stepped window (wait for the whole reset, then spend) is what made the
 * old pacer's waits so much longer than they needed to be.
 *
 * Held per model, because the buckets are per model: measured against the
 * deployed key, `qwen/qwen3.8-27b` and `openai/gpt-oss-120b` each reported
 * their own 8,000 and decremented independently.
 */

/** Assumed window when the endpoint reports a limit but no reset. */
const DEFAULT_WINDOW_MS = 60_000;

/**
 * What we assume before the first response has been seen.
 *
 * Groq's free tier at the time of writing. It is only ever used for the first
 * call of a cold process; the very next response replaces it with the endpoint's
 * own number, including on a deployment whose ceiling is different.
 */
const ASSUMED_LIMIT = 8_000;

export interface BudgetSnapshot {
  /** Tokens the window holds when full. */
  limit: number;
  /** Tokens available right now, refill included. */
  remaining: number;
  /** Whether any response has been observed, i.e. whether this is measured. */
  measured: boolean;
  /** Epoch ms at which the bucket is full again. */
  fullAt: number;
  /**
   * Set once the endpoint has refused on a per-day ceiling: how long until that
   * ceiling has room again, and what it is. Distinguished from the per-minute
   * wait because the honest thing to tell someone facing a seventeen-minute
   * daily wall is not "resuming shortly".
   */
  dailyExhausted?: { untilMs: number; limit?: number; used?: number };
}

/**
 * Which ceiling a refusal was about.
 *
 * The distinction is the whole point of parsing these. A per-minute limit is a
 * pause: wait, and the same request succeeds. A per-day limit is a wall: waiting
 * seventeen minutes gets you one more call and then another seventeen. They
 * arrive as the same 429 with the same shape of `retry-after`, and treating the
 * second as the first is what produced the failure this was built to fix — a
 * brief that sat in a retry loop for twelve minutes and then died anyway.
 */
export type LimitScope = 'tokens-per-minute' | 'tokens-per-day' | 'requests' | 'unknown';

export interface RateLimitFacts {
  scope: LimitScope;
  /** The ceiling, as the endpoint stated it. */
  limit?: number;
  /** How much of it was already spent. */
  used?: number;
  /** What this request would have cost — prompt plus reserved completion. */
  requested?: number;
  retryAfterMs?: number;
}

/**
 * Read a 429 body for what it actually says.
 *
 * These numbers exist nowhere else. Groq's headers describe the per-minute
 * bucket and only the per-minute bucket: on the run that motivated this file
 * they read a comfortable `remaining-tokens: 8000` while every request was being
 * refused, because the ceiling being hit was the daily one and nothing in the
 * headers mentions it. The body did:
 *
 *     Rate limit reached for model `qwen/qwen3.8-27b` … on tokens per day
 *     (TPD): Limit 200000, Used 199754, Requested 2679. Please try again in
 *     17m31.056s.
 *
 * So the body is parsed, and a deployment gets told which of the two walls it
 * has hit. Matched loosely — the wording is somebody else's and will drift — and
 * every field is optional, because a fact we failed to extract must degrade to
 * "unknown limit, honour the retry-after" rather than to a confident wrong
 * number.
 */
export function parseRateLimitError(message: string): RateLimitFacts {
  const text = message ?? '';
  const scope: LimitScope = /tokens per day|\bTPD\b/i.test(text)
    ? 'tokens-per-day'
    : /tokens per minute|\bTPM\b/i.test(text)
      ? 'tokens-per-minute'
      : /requests per (minute|day)|\bRP[MD]\b/i.test(text)
        ? 'requests'
        : 'unknown';

  const number = (label: string): number | undefined => {
    const match = new RegExp(`${label}\\s+([\\d,]+)`, 'i').exec(text);
    if (!match) return undefined;
    const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
    return Number.isFinite(value) ? value : undefined;
  };

  const retry = /try again in ([\dhms.]+)/i.exec(text);

  return {
    scope,
    limit: number('Limit'),
    used: number('Used'),
    requested: number('Requested'),
    retryAfterMs: retry ? parseDuration(retry[1]) : undefined,
  };
}

/**
 * A duration as these endpoints write one: `7.66s`, `2m59.56s`, `150ms`, `1h2m`.
 * Returns milliseconds, or undefined for anything unrecognised — a header we
 * cannot parse must not silently become a zero wait.
 */
export function parseDuration(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const text = raw.trim().toLowerCase();
  if (!text) return undefined;

  // A bare number is seconds, which is what `retry-after` sends.
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number.parseFloat(text) * 1_000);

  const pattern = /(\d+(?:\.\d+)?)\s*(ms|s|m|h)/g;
  let total = 0;
  let matched = false;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    matched = true;
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value)) return undefined;
    const unit = match[2];
    total +=
      unit === 'ms' ? value : unit === 's' ? value * 1_000 : unit === 'm' ? value * 60_000 : value * 3_600_000;
  }
  return matched ? Math.round(total) : undefined;
}

function readNumber(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null) return undefined;
  const value = Number.parseFloat(raw.trim());
  return Number.isFinite(value) ? value : undefined;
}

/**
 * One endpoint-and-model's token bucket, as last reported by the endpoint.
 *
 * The two numbers held are a reading and the moment it was taken; everything
 * else is derived, so a budget that is never updated simply refills to full and
 * stops constraining anything. That is the correct failure mode for an endpoint
 * that sends no rate-limit headers at all (Ollama, vLLM): no headers means no
 * measured ceiling means no pacing, which is what `isLocalInference` used to
 * have to special-case.
 */
export class TokenBudget {
  private limit = ASSUMED_LIMIT;
  private windowMs = DEFAULT_WINDOW_MS;
  /** Tokens available as of `readingAt`. */
  private reading = ASSUMED_LIMIT;
  private readingAt = 0;
  private seen = false;
  /** Set from a 429's `retry-after`: nothing may be spent before this. */
  private blockedUntil = 0;
  /** Set when a refusal named a per-day ceiling rather than a per-minute one. */
  private dailyBlockedUntil = 0;
  private dailyLimit: number | undefined;
  private dailyUsed: number | undefined;

  /** Tokens per millisecond the bucket refills at. */
  private get refillRate(): number {
    return this.limit / this.windowMs;
  }

  /** Capacity at `at`, from the last reading plus refill since. */
  available(at: number = Date.now()): number {
    if (this.readingAt === 0) return this.limit;
    const refilled = this.reading + (at - this.readingAt) * this.refillRate;
    return Math.max(0, Math.min(this.limit, refilled));
  }

  /**
   * Fold in one response's rate-limit headers.
   *
   * Only moves the reading forward in time; an out-of-order response from a
   * request that started earlier must not resurrect stale capacity.
   */
  observe(headers: Headers, at: number = Date.now()): void {
    const limit = readNumber(headers, 'x-ratelimit-limit-tokens');
    const remaining = readNumber(headers, 'x-ratelimit-remaining-tokens');
    const reset = parseDuration(headers.get('x-ratelimit-reset-tokens'));

    if (limit !== undefined && limit > 0) this.limit = limit;

    // `reset` is the time until full, so the window it implies is that time
    // scaled by how empty the bucket is. Derived rather than assumed because a
    // deployment metering per hour rather than per minute reports the same
    // headers and would otherwise be paced sixty times too aggressively.
    if (reset !== undefined && reset > 0 && remaining !== undefined && remaining < this.limit) {
      const deficit = this.limit - remaining;
      const derived = (reset * this.limit) / deficit;
      if (Number.isFinite(derived) && derived > 0) {
        this.windowMs = Math.min(3_600_000, Math.max(1_000, derived));
      }
    }

    if (remaining !== undefined && at >= this.readingAt) {
      this.reading = Math.max(0, remaining);
      this.readingAt = at;
      this.seen = true;
    }

    const retryAfter = parseDuration(headers.get('retry-after'));
    if (retryAfter !== undefined && retryAfter > 0) {
      this.blockedUntil = Math.max(this.blockedUntil, at + retryAfter);
    }
  }

  /**
   * Record a spend the headers have not caught up with yet.
   *
   * Requests in flight concurrently — the SDK's own retries, a chat turn
   * overlapping a deliverable — are not reflected in a response that was already
   * on the wire when they were sent. Debiting locally at request time keeps the
   * budget conservative between readings; the next response corrects it.
   *
   * Ignored until the endpoint has actually claimed a limit. That one condition
   * replaces the `isLocalInference()` special case the old pacer needed: an
   * endpoint that sends no rate-limit headers — Ollama, vLLM, anything self
   * hosted — never becomes measured, so it never accrues a debit, so it is never
   * paced. Pacing switches itself on when something says there is a ceiling,
   * rather than when a URL happens to match a regex.
   */
  debit(tokens: number, at: number = Date.now()): void {
    if (tokens <= 0 || !this.seen) return;
    this.reading = Math.max(0, this.available(at) - tokens);
    this.readingAt = at;
  }

  /** Whether the endpoint has ever reported a ceiling. */
  get isMeasured(): boolean {
    return this.seen;
  }

  /**
   * Fold in what a refusal said about itself.
   *
   * A per-day refusal is recorded separately and deliberately does not become a
   * `blockedUntil`: callers need to be able to ask "is this a pause or a wall"
   * and get different answers, and a caller that simply waits out
   * `blockedUntil` would sit through a seventeen-minute daily wall pretending
   * it was pacing.
   */
  observeRefusal(facts: RateLimitFacts, at: number = Date.now()): void {
    const retry = facts.retryAfterMs;

    if (facts.scope === 'tokens-per-day') {
      this.dailyLimit = facts.limit ?? this.dailyLimit;
      this.dailyUsed = facts.used ?? this.dailyUsed;
      if (retry !== undefined && retry > 0) {
        this.dailyBlockedUntil = Math.max(this.dailyBlockedUntil, at + retry);
      }
      return;
    }

    // A per-minute refusal against a limit we thought we had room under means
    // the reading was stale; treat the stated limit as authoritative and empty
    // the bucket, so the next `waitFor` computes a real refill rather than
    // waving the same doomed request straight back out.
    if (facts.limit !== undefined && facts.limit > 0) this.limit = facts.limit;
    if (facts.scope === 'tokens-per-minute') {
      this.reading = 0;
      this.readingAt = at;
      this.seen = true;
    }
    if (retry !== undefined && retry > 0) {
      this.blockedUntil = Math.max(this.blockedUntil, at + retry);
    }
  }

  /**
   * How long the per-day ceiling stays shut, or 0 if it is not the problem.
   *
   * Callers use this to decide whether to keep pacing or to stop and say so.
   */
  dailyBlockFor(at: number = Date.now()): number {
    return Math.max(0, this.dailyBlockedUntil - at);
  }

  /**
   * Assert a ceiling the endpoint does not report, for `LLM_TOKENS_PER_MINUTE`.
   *
   * With headers being read directly, this variable no longer has to be set for
   * an ordinary hosted deployment — a paid Groq tier reports its own larger
   * limit and is paced correctly with no configuration at all. What is left for
   * it is the endpoint that meters silently: it enforces a ceiling and sends
   * nothing to say so, and without a declaration here it would be paced as if it
   * were free until it started refusing calls.
   */
  declareLimit(limit: number, windowMs = DEFAULT_WINDOW_MS, at: number = Date.now()): void {
    if (!Number.isFinite(limit) || limit <= 0) return;
    this.limit = limit;
    this.windowMs = windowMs;
    if (!this.seen) {
      this.reading = limit;
      this.readingAt = at;
      this.seen = true;
    }
  }

  /**
   * Milliseconds to wait before spending `projected` tokens, or 0.
   *
   * A call larger than the whole window can never fit, and stalling forever is
   * worse than letting the endpoint give a clear answer — so it goes straight
   * through, exactly as the old pacer decided for the same case.
   */
  waitFor(projected: number, at: number = Date.now()): number {
    const blocked = Math.max(0, this.blockedUntil - at);
    if (projected >= this.limit) return blocked;

    const short = projected - this.available(at);
    const refill = short <= 0 ? 0 : Math.ceil(short / this.refillRate);
    return Math.max(blocked, refill);
  }

  snapshot(at: number = Date.now()): BudgetSnapshot {
    const available = this.available(at);
    const daily = this.dailyBlockFor(at);
    return {
      limit: this.limit,
      remaining: Math.floor(available),
      measured: this.seen,
      fullAt: at + Math.ceil((this.limit - available) / this.refillRate),
      ...(daily > 0
        ? { dailyExhausted: { untilMs: daily, limit: this.dailyLimit, used: this.dailyUsed } }
        : {}),
    };
  }

  /** Test seam. */
  reset(): void {
    this.limit = ASSUMED_LIMIT;
    this.windowMs = DEFAULT_WINDOW_MS;
    this.reading = ASSUMED_LIMIT;
    this.readingAt = 0;
    this.seen = false;
    this.blockedUntil = 0;
    this.dailyBlockedUntil = 0;
    this.dailyLimit = undefined;
    this.dailyUsed = undefined;
  }
}

/**
 * Budgets keyed by endpoint and model.
 *
 * Module-level, i.e. one per server instance rather than one per run. That is
 * the correct scope and a deliberate change from the per-run pacer it replaces:
 * the quota is the account's, so two runs on one instance genuinely do take from
 * each other, and a pacer that pretended otherwise was the reason a second
 * request could push the first into a 429 it had already paced around. On
 * serverless the instance is not the whole account either — but a reading
 * refreshed from every response converges on the truth within one call, which is
 * as close as a stateless deployment gets.
 */
const budgets = new Map<string, TokenBudget>();

export function budgetFor(key: string): TokenBudget {
  const existing = budgets.get(key);
  if (existing) return existing;
  const created = new TokenBudget();
  budgets.set(key, created);
  return created;
}

/** Test seam: forget every observed budget. */
export function resetBudgets(): void {
  budgets.clear();
}

/**
 * A `fetch` that keeps `budgetFor(key)` current.
 *
 * Installed on the provider rather than called by the engine, so that *every*
 * request through this endpoint updates the budget — chat turns, the PII screen,
 * and the SDK's internal retries included. Those are precisely the spends an
 * engine-level accountant cannot see, and precisely the ones that were pushing
 * deliverable runs over the ceiling.
 */
export function budgetTrackingFetch(key: string, underlying: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const budget = budgetFor(key);
    const response = await underlying(input, init);
    budget.observe(response.headers);

    // A refusal carries the only statement of the per-day ceiling there is, and
    // it is in the body rather than the headers. Read from a clone so the SDK
    // still gets an unconsumed stream to produce its own error from, and only
    // for a 429 — cloning a streamed 200 would buffer a whole completion in
    // memory for nothing.
    if (response.status === 429) {
      try {
        const text = await response.clone().text();
        budget.observeRefusal(parseRateLimitError(text));
      } catch {
        // A body that cannot be re-read costs us the daily numbers, not
        // correctness: the `retry-after` header was already folded in above.
      }
    }
    return response;
  };
}
