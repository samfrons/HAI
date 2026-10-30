import { describe, expect, it } from 'vitest';

import {
  TokenBudget,
  budgetTrackingFetch,
  parseDuration,
  parseRateLimitError,
} from './rate-limit';

/** The headers Groq actually sends, so the parsing is tested against reality. */
function headers(fields: Record<string, string>): Headers {
  return new Headers(fields);
}

describe('parseDuration', () => {
  it('reads the shapes these endpoints actually send', () => {
    expect(parseDuration('7.66s')).toBe(7_660);
    expect(parseDuration('134ms')).toBe(134);
    expect(parseDuration('2m59.56s')).toBe(179_560);
    expect(parseDuration('1h2m3s')).toBe(3_723_000);
    // A bare number is `retry-after`, which is seconds.
    expect(parseDuration('81')).toBe(81_000);
  });

  it('refuses to guess', () => {
    // A header we cannot read must not become a zero wait.
    expect(parseDuration('soon')).toBeUndefined();
    expect(parseDuration(null)).toBeUndefined();
    expect(parseDuration('')).toBeUndefined();
  });
});

describe('TokenBudget', () => {
  it('says nothing about an endpoint that never claims a ceiling', () => {
    // Ollama and friends send no rate-limit headers. Nothing here should pace
    // them — this is what replaced the old `isLocalInference()` URL check.
    const budget = new TokenBudget();
    budget.debit(50_000);
    expect(budget.waitFor(50_000)).toBe(0);
    expect(budget.isMeasured).toBe(false);
  });

  it('takes the endpoint at its word once it has spoken', () => {
    const budget = new TokenBudget();
    const at = 1_000_000;
    budget.observe(
      headers({
        'x-ratelimit-limit-tokens': '8000',
        'x-ratelimit-remaining-tokens': '2000',
        'x-ratelimit-reset-tokens': '45s',
      }),
      at,
    );

    expect(budget.isMeasured).toBe(true);
    expect(budget.available(at)).toBe(2_000);
    // 2,000 available, so 2,000 needs no wait and 3,000 does.
    expect(budget.waitFor(2_000, at)).toBe(0);
    expect(budget.waitFor(3_000, at)).toBeGreaterThan(0);
  });

  it('refills continuously rather than in steps', () => {
    const budget = new TokenBudget();
    const at = 1_000_000;
    budget.observe(
      headers({
        'x-ratelimit-limit-tokens': '8000',
        'x-ratelimit-remaining-tokens': '0',
        'x-ratelimit-reset-tokens': '60s',
      }),
      at,
    );

    // Half a window later, half the bucket is back. The old pacer treated this
    // as a stepped window and waited for the whole reset every time, which is
    // most of why a six-section brief could not finish inside one request.
    expect(budget.available(at + 30_000)).toBeCloseTo(4_000, -2);
    expect(budget.waitFor(4_000, at)).toBeGreaterThan(25_000);
    expect(budget.waitFor(4_000, at)).toBeLessThan(35_000);
  });

  it('lets a call bigger than the whole window through rather than stalling forever', () => {
    const budget = new TokenBudget();
    budget.declareLimit(8_000);
    // Nothing can free up enough for this, and a clear upstream error beats an
    // infinite wait.
    expect(budget.waitFor(20_000)).toBe(0);
  });

  /*
   * The production failure. Groq refused a live Sudan brief on its per-day
   * ceiling while its per-minute headers read a perfectly healthy 8,000 of
   * 8,000 — so a budget watching only the headers concluded all was well and
   * the engine retried into the wall for twelve minutes.
   */
  it('records a per-day refusal without touching the per-minute reading', () => {
    const budget = new TokenBudget();
    const at = 1_000_000;
    budget.observe(
      headers({
        'x-ratelimit-limit-tokens': '8000',
        'x-ratelimit-remaining-tokens': '8000',
        'x-ratelimit-reset-tokens': '1ms',
      }),
      at,
    );
    budget.observeRefusal(
      parseRateLimitError(
        'on tokens per day (TPD): Limit 200000, Used 199754, Requested 2679. ' +
          'Please try again in 17m31.056s.',
      ),
      at,
    );

    expect(budget.waitFor(2_000, at)).toBe(0);
    expect(budget.dailyBlockFor(at)).toBeGreaterThan(17 * 60_000);
    expect(budget.snapshot(at).dailyExhausted).toMatchObject({
      limit: 200_000,
      used: 199_754,
    });
  });

  it('empties the bucket when a per-minute refusal proves the reading was stale', () => {
    const budget = new TokenBudget();
    const at = 1_000_000;
    budget.observe(
      headers({ 'x-ratelimit-limit-tokens': '8000', 'x-ratelimit-remaining-tokens': '7000' }),
      at,
    );
    budget.observeRefusal(
      parseRateLimitError('on tokens per minute (TPM): Limit 8000, Requested 6000'),
      at,
    );

    // Believing the stale 7,000 would send the same doomed request straight
    // back out.
    expect(budget.waitFor(6_000, at)).toBeGreaterThan(0);
  });
});

describe('budgetTrackingFetch', () => {
  it('folds a refusal body into the budget', async () => {
    const budget = new TokenBudget();
    const body = JSON.stringify({
      error: {
        message:
          'Rate limit reached … on tokens per day (TPD): Limit 200000, Used 199754, ' +
          'Requested 2679. Please try again in 17m31.056s.',
      },
    });

    const tracked = budgetTrackingFetch('k', async () => new Response(body, { status: 429 }));
    // The tracking fetch resolves the key through the shared registry, so this
    // asserts through the same door production uses.
    const { budgetFor } = await import('./rate-limit');
    const shared = budgetFor('k');
    shared.reset();

    const response = await tracked('https://example.invalid');

    expect(shared.dailyBlockFor()).toBeGreaterThan(17 * 60_000);
    // The SDK still needs to read the body to build its own error from it.
    await expect(response.text()).resolves.toContain('tokens per day');
    expect(budget.isMeasured).toBe(false);
  });
});
