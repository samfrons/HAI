import { afterEach, describe, expect, it, vi } from 'vitest';

import fundingFixture from './__fixtures__/hpc-plan-funding-1498.json';
import plansFixture from './__fixtures__/hpc-plans-2026.json';
import { fetchPlanFunding, fetchPlans, normalizePlanFunding, normalizePlans } from './hpc';

/**
 * Fixtures are real OCHA HPC.tools responses: three 2026 response plans, and
 * FTS funding flows for one of them (Cameroon, plan 1498), flows array
 * trimmed to four entries.
 */

describe('normalizePlans', () => {
  it('reads the plan name and dates from planVersion', () => {
    const plans = normalizePlans(plansFixture);
    expect(plans).toHaveLength(3);
    expect(plans[0]).toEqual({
      source: 'OCHA HPC',
      id: 1498,
      name: 'Cameroon Humanitarian Needs and Response Plan 2026',
      code: 'HCMR26',
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('returns an empty list rather than throwing when there is no data', () => {
    expect(normalizePlans({})).toEqual([]);
  });
});

describe('normalizePlanFunding', () => {
  it('reads incoming totals and the flow count', () => {
    const funding = normalizePlanFunding(fundingFixture, 1498);
    expect(funding).toEqual({
      source: 'OCHA FTS',
      planId: 1498,
      fundingUsd: 85505871,
      pledgesUsd: 0,
      flowCount: 4,
    });
  });

  it('defaults to nulls and a zero flow count on an empty payload', () => {
    expect(normalizePlanFunding({}, 99)).toEqual({
      source: 'OCHA FTS',
      planId: 99,
      fundingUsd: null,
      pledgesUsd: null,
      flowCount: 0,
    });
  });
});

describe('fetchPlans / fetchPlanFunding', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws with the status on a non-OK plans response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );
    await expect(fetchPlans(1900)).rejects.toThrow(/502/);
  });

  it('parses a live-shaped plans response end to end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(plansFixture), { status: 200 })),
    );
    const plans = await fetchPlans(1901);
    expect(plans).toHaveLength(3);
  });

  it('includes the plan id on a funding-fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(fetchPlanFunding(999999)).rejects.toThrow(/999999/);
  });
});
