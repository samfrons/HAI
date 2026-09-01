import { afterEach, describe, expect, it, vi } from 'vitest';

import { harvest } from '../agent/evidence';
import { getCrisisUpdates } from './crisis-updates';

/**
 * The behaviour under test is what an unconfigured ReliefWeb does to the rest
 * of the product, not what it returns in isolation.
 *
 * Production runs with no RELIEFWEB_APPNAME. The tool then answers perfectly
 * well from IFRC GO — but it used to announce that in `notice`, and `notice` is
 * this codebase's word for "the retrieval came back empty". Both trace readers
 * act on it: `evidence.ts` turns it into a `source-error` and `chat-trace.ts`
 * into an `ok: false` step. So every successful crisis lookup was reported as a
 * failed source, once per call and again per deliverable section. These tests
 * pin the fix at that seam by running the result through `harvest()`.
 */

const IFRC_PAYLOAD = {
  results: [
    {
      id: 7788,
      name: 'Sudan: Complex Emergency',
      summary: 'Displacement continues across Darfur states.',
      disaster_start_date: '2026-07-04T00:00:00Z',
      ifrc_severity_level_display: 'Orange',
      num_affected: 120000,
      dtype: { name: 'Complex Emergency' },
      countries: [{ name: 'Sudan' }],
    },
  ],
};

const RELIEFWEB_PAYLOAD = {
  data: [
    {
      fields: {
        title: 'Sudan Situation Report',
        url: 'https://reliefweb.int/report/sudan/1',
        date: { created: '2026-08-30T00:00:00+00:00' },
        source: [{ name: 'OCHA' }],
        'body-html': '<p>Access constraints persist.</p>',
      },
    },
  ],
};

/** Routes by host so a test can assert which upstreams were touched. */
function stubFetch(options: { reliefWebStatus?: number } = {}) {
  const calls: string[] = [];
  const mock = vi.fn(async (url: string | URL) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('api.reliefweb.int')) {
      const status = options.reliefWebStatus ?? 200;
      return new Response(JSON.stringify(RELIEFWEB_PAYLOAD), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(IFRC_PAYLOAD), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', mock);
  return calls;
}

let queryCounter = 0;
/** The module cache is per-process, so every test needs its own cache key. */
function uniqueQuery(): string {
  queryCounter += 1;
  return `displacement-case-${queryCounter}`;
}

function harvestOf(result: unknown) {
  let n = 0;
  return harvest('crisis_updates', result, () => `e${(n += 1)}`);
}

describe('getCrisisUpdates with RELIEFWEB_APPNAME unset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('never calls ReliefWeb and answers from IFRC GO', async () => {
    vi.stubEnv('RELIEFWEB_APPNAME', '');
    const calls = stubFetch();

    const result = await getCrisisUpdates(uniqueQuery(), 'Sudan');

    expect(calls.some((url) => url.includes('reliefweb'))).toBe(false);
    expect(result.retrievedVia).toBe('ifrc-go');
    expect(result.updates).toHaveLength(1);
  });

  it('reports ReliefWeb as unavailable once, and not as a failure of the tool', async () => {
    vi.stubEnv('RELIEFWEB_APPNAME', '');
    stubFetch();

    const result = await getCrisisUpdates(uniqueQuery(), 'Sudan');

    // `notice` stays free for a genuinely empty retrieval.
    expect(result.notice).toBeUndefined();
    expect(result.sourceNote).toContain('IFRC GO');
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].source).toBe('ReliefWeb');
    // Honest and readable by an operator: what is off, and what they get instead.
    expect(result.errors?.[0].message).toMatch(/not enabled/i);
    expect(result.errors?.[0].message).toContain('OCHA');
  });

  it('harvests as a working source with one unavailable upstream', async () => {
    vi.stubEnv('RELIEFWEB_APPNAME', '');
    stubFetch();

    const { items, errors } = harvestOf(await getCrisisUpdates(uniqueQuery(), 'Sudan'));

    // The updates are evidence, not a degraded source.
    expect(items.length).toBeGreaterThan(0);
    // Exactly one issue, attributed to ReliefWeb rather than to `crisis_updates`.
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('crisis_updates · ReliefWeb');
  });

  it('still reports a genuinely empty retrieval through notice', async () => {
    vi.stubEnv('RELIEFWEB_APPNAME', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await getCrisisUpdates(uniqueQuery(), 'Atlantis');

    expect(result.updates).toHaveLength(0);
    expect(result.notice).toMatch(/No matching emergencies/);
  });
});

describe('getCrisisUpdates with RELIEFWEB_APPNAME set', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses ReliefWeb and reports no source issues', async () => {
    vi.stubEnv('RELIEFWEB_APPNAME', 'approved-appname');
    const calls = stubFetch();

    const result = await getCrisisUpdates(uniqueQuery(), 'Sudan');

    expect(calls.some((url) => url.includes('api.reliefweb.int'))).toBe(true);
    expect(result.retrievedVia).toBe('reliefweb');
    expect(result.errors).toBeUndefined();
    expect(harvestOf(result).errors).toHaveLength(0);
  });

  it('falls back to IFRC GO and records why when ReliefWeb rejects the appname', async () => {
    vi.stubEnv('RELIEFWEB_APPNAME', 'revoked-appname');
    stubFetch({ reliefWebStatus: 403 });

    const result = await getCrisisUpdates(uniqueQuery(), 'Sudan');

    expect(result.retrievedVia).toBe('ifrc-go');
    expect(result.updates).toHaveLength(1);
    expect(result.errors?.[0].source).toBe('ReliefWeb');
    expect(result.errors?.[0].message).toContain('403');
  });
});
