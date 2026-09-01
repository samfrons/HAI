import { describe, expect, it } from 'vitest';

import { TokenPacer, estimateTokens, isRateLimitError } from './pacer';

describe('TokenPacer', () => {
  it('lets a run through until the minute is spent', () => {
    const pacer = new TokenPacer(8_000, true);
    expect(pacer.waitFor(3_000)).toBe(0);
  });

  it('holds the next call until the oldest spending ages out', async () => {
    const pacer = new TokenPacer(8_000, true);
    await pacer.reserve(5_000);
    await pacer.reserve(2_500);

    // 7,500 of 8,000 spent: a 1,000-token call has to wait for the 5,000 to
    // fall out of the trailing minute.
    const wait = pacer.waitFor(1_000);
    expect(wait).toBeGreaterThan(55_000);
    expect(wait).toBeLessThanOrEqual(60_000);
  });

  /*
   * Estimates are deliberately high (see CHARS_PER_TOKEN). Without settling
   * them against real usage the pacer would throttle a run by whatever margin
   * it built in — which on an eighteen-call workflow is minutes of invented
   * waiting.
   */
  it('gives back the margin once real usage is known', async () => {
    const pacer = new TokenPacer(8_000, true);
    await pacer.reserve(7_900);
    pacer.settle(7_900, 1_200);
    expect(pacer.waitFor(5_000)).toBe(0);
  });

  it('does nothing at all against a local endpoint, where there is no ceiling', async () => {
    const pacer = new TokenPacer(10, false);
    await pacer.reserve(1_000_000);
    expect(pacer.waitFor(1_000_000)).toBe(0);
  });

  it('lets a call larger than the whole budget through rather than stalling forever', () => {
    const pacer = new TokenPacer(8_000, true);
    expect(pacer.waitFor(20_000)).toBe(0);
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
