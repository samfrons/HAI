import { describe, expect, it } from 'vitest';

import { TokenBudget, parseRateLimitError } from '@/lib/llm/rate-limit';

import {
  TokenPacer,
  estimateToolLoopTokens,
  estimateTokens,
  isDailyLimit,
  isRateLimitError,
} from './pacer';

/**
 * A budget already told what the endpoint's ceiling is, without a live call.
 * `declareLimit` is the same door `LLM_TOKENS_PER_MINUTE` comes through, so
 * these exercise the production path rather than a test-only seam.
 */
function measured(limit = 8_000): TokenBudget {
  const budget = new TokenBudget();
  budget.declareLimit(limit);
  return budget;
}

describe('TokenPacer', () => {
  it('lets a run through while the endpoint has room', () => {
    expect(new TokenPacer(measured()).waitFor(3_000)).toBe(0);
  });

  it('holds the next call until the bucket has refilled enough', async () => {
    const pacer = new TokenPacer(measured());
    await pacer.reserve(5_000);
    await pacer.reserve(2_500);

    // 7,500 of 8,000 spent. The bucket refills continuously rather than in
    // steps, so the wait is the time to earn back what is short — not a full
    // window. The old sliding-window pacer waited nearly a minute here, and
    // that difference is most of why a six-section brief could not finish.
    const wait = pacer.waitFor(1_000);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThan(30_000);
  });

  it('is silent about an endpoint that never claims a ceiling', async () => {
    // No headers seen and nothing declared: local Ollama, vLLM, anything self
    // hosted. Replaces the old `isLocalInference()` URL check.
    const pacer = new TokenPacer(new TokenBudget());
    await pacer.reserve(1_000_000);
    expect(pacer.waitFor(1_000_000)).toBe(0);
    expect(pacer.isPacing).toBe(false);
  });

  it('lets a call larger than the whole budget through rather than stalling forever', () => {
    expect(new TokenPacer(measured()).waitFor(20_000)).toBe(0);
  });

  /*
   * The failure this file was rewritten for. Groq refused a live Sudan brief on
   * its per-day ceiling while its per-minute headers reported the bucket full,
   * and the engine — which only knew about minutes — retried into it for twelve
   * minutes. A daily block has to be legible as something other than pacing.
   */
  it('reports a daily ceiling separately from a per-minute one', () => {
    const budget = measured();
    budget.observeRefusal(
      parseRateLimitError(
        'Rate limit reached for model `qwen/qwen3.8-27b` in organization `org_x` ' +
          'service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199754, ' +
          'Requested 2679. Please try again in 17m31.056s.',
      ),
    );
    const pacer = new TokenPacer(budget);

    expect(pacer.dailyBlockMs()).toBeGreaterThan(17 * 60_000);
    // The per-minute bucket is untouched by this, which is exactly the trap:
    // a pacer looking only here would conclude everything was fine.
    expect(pacer.waitFor(1_000)).toBe(0);
    expect(pacer.snapshot().dailyExhausted?.used).toBe(199_754);
  });
});

describe('parseRateLimitError', () => {
  it('reads the numbers out of a per-day refusal', () => {
    const facts = parseRateLimitError(
      'on tokens per day (TPD): Limit 200000, Used 199754, Requested 2679. ' +
        'Please try again in 17m31.056s.',
    );
    expect(facts).toMatchObject({
      scope: 'tokens-per-day',
      limit: 200_000,
      used: 199_754,
      requested: 2_679,
    });
    expect(facts.retryAfterMs).toBeCloseTo(1_051_056, -3);
  });

  /*
   * The other half of the live failure: a request refused not for the account
   * being out of budget but for reserving a completion larger than the whole
   * per-minute ceiling. `Requested 16395` against `Limit 8000` is an uncapped
   * `maxOutputTokens`, not a busy endpoint — see the engine's output caps.
   */
  it('reads a per-minute refusal caused by an oversized reservation', () => {
    expect(
      parseRateLimitError(
        'on tokens per minute (TPM): Limit 8000, Requested 16395, please reduce your message size',
      ),
    ).toMatchObject({ scope: 'tokens-per-minute', limit: 8_000, requested: 16_395 });
  });

  it('degrades to unknown rather than inventing a scope', () => {
    expect(parseRateLimitError('something went wrong').scope).toBe('unknown');
  });
});

describe('isDailyLimit', () => {
  it('separates the wall from the pause', () => {
    expect(isDailyLimit(new Error('on tokens per day (TPD): Limit 200000'))).toBe(true);
    expect(isDailyLimit(new Error('on tokens per minute (TPM): Limit 8000'))).toBe(false);
  });
});

describe('estimateTokens', () => {
  it('counts the prompt and the expected reply', () => {
    expect(estimateTokens('x'.repeat(350), 100)).toBe(200);
  });
});

describe('isRateLimitError', () => {
  it('recognises the endpoint saying "too fast"', () => {
    expect(isRateLimitError(new Error('Rate limit reached for model, try again in 8.5s'))).toBe(true);
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
    expect(isRateLimitError(new Error('Limit 8000, Used 7000, Requested 2000 tokens per min'))).toBe(true);
  });

  it('does not retry a request that was simply wrong', () => {
    expect(isRateLimitError(new Error('property reasoning_content is unsupported'))).toBe(false);
    expect(isRateLimitError({ statusCode: 400 })).toBe(false);
  });
});

describe('estimateToolLoopTokens', () => {
  /*
   * The arithmetic that a live Sudan brief proved was missing. Three steps do
   * not cost three tool results: results accumulate, so step two re-sends step
   * one's and step three re-sends both. Reserving a flat per-call figure
   * under-estimated a gather by roughly a factor of three and let enough
   * requests through in one minute for Groq to refuse one.
   */
  it('charges for tool results being re-sent on every later step', () => {
    const oneStep = estimateToolLoopTokens(2, 1, 0);
    const threeSteps = estimateToolLoopTokens(2, 3, 0);

    // 1 result vs 1+2+3 = 6, plus schemas re-sent each step.
    expect(threeSteps).toBeGreaterThan(oneStep * 3);
  });

  it('charges for every tool in the subset, not just the one called', () => {
    expect(estimateToolLoopTokens(4, 2, 0)).toBeGreaterThan(estimateToolLoopTokens(1, 2, 0));
  });

  /*
   * The constraint that set `GATHER_STEP_CAP` in the engine. A gather has to
   * leave room in the same minute for the draft and verify calls that follow
   * it, or every section waits out a full window and a six-section brief takes
   * ten minutes. At three steps this came to 6,630 of the 8,000 available —
   * which is what sent it back to two.
   */
  it('leaves room in the minute for the draft and verify that follow a gather', () => {
    const gather = estimateToolLoopTokens(3, 2);
    expect(gather).toBeLessThan(6_000);

    // Draft and verify are prompt-plus-output calls of roughly this size.
    expect(gather + 2 * 1_000).toBeLessThan(8_000);
  });

  it('shows why a third step does not fit', () => {
    expect(estimateToolLoopTokens(3, 3)).toBeGreaterThan(6_000);
  });
});
