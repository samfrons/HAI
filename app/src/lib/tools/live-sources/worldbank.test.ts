import { afterEach, describe, expect, it, vi } from 'vitest';

import fixture from './__fixtures__/worldbank-population-sdn.json';
import { fetchCountryContext, fetchIndicator, normalizeIndicator } from './worldbank';

/** Fixture is a real World Bank `SP.POP.TOTL` response for Sudan (`?mrnev=1`). */

describe('normalizeIndicator', () => {
  it('reads the most-recent-non-empty row', () => {
    const row = normalizeIndicator(fixture, 'SP.POP.TOTL');
    expect(row).toEqual({
      source: 'World Bank',
      indicator: 'SP.POP.TOTL',
      name: 'Population, total',
      country: 'Sudan',
      year: '2025',
      value: 51662147,
    });
  });

  it('returns null when the series has no data for the country', () => {
    expect(normalizeIndicator([{ page: 1 }, null], 'SM.POP.REFG')).toBeNull();
  });

  it('returns null on a malformed payload rather than throwing', () => {
    expect(normalizeIndicator({ unexpected: true }, 'SP.POP.TOTL')).toBeNull();
    expect(normalizeIndicator([{ page: 1 }], 'SP.POP.TOTL')).toBeNull();
  });
});

describe('fetchIndicator / fetchCountryContext', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws with the indicator and status on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    await expect(fetchIndicator('ZZZ', 'SP.POP.TOTL')).rejects.toThrow(/404/);
  });

  it('degrades one failing indicator without failing the whole country profile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('SP.POP.TOTL')) {
          return new Response(JSON.stringify(fixture), { status: 200 });
        }
        return new Response('', { status: 500 });
      }),
    );
    const profile = await fetchCountryContext('XYZ_TEST');
    expect(profile).toHaveLength(1);
    expect(profile[0].indicator).toBe('SP.POP.TOTL');
  });
});
