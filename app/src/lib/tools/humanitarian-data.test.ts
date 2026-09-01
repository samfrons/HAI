import { afterEach, describe, expect, it, vi } from 'vitest';

import foodSecurityFixture from './__fixtures__/hapi-food-security-sdn.json';
import fundingFixture from './__fixtures__/hapi-funding-sdn.json';
import needsFixture from './__fixtures__/hapi-humanitarian-needs-sdn.json';
import populationFixture from './__fixtures__/hapi-population-sdn.json';
import {
  fetchHumanitarianData,
  transformFoodSecurity,
  transformFunding,
  transformNeeds,
  transformPopulation,
  type DataResult,
} from './humanitarian-data';

/**
 * The fixtures are real HDX HAPI v2 responses for Sudan, captured live and
 * trimmed to the rows that exercise the shape (aggregate rows next to their own
 * disaggregations, several planning cycles, several appeals). They are the
 * unhappy shapes, not tidy ones — that is the point of keeping them.
 *
 * The failure cases matter as much as the transformations. HAPI answers 200
 * with an empty array for any unrecognised location, so a tool that reports
 * emptiness without a reason is indistinguishable from one that found nothing,
 * and the model that consumes it falls back on memory. Those tests are here to
 * keep that distinction from regressing.
 */

function metric(result: DataResult, prefix: string) {
  return result.figures.find((figure) => figure.metric.startsWith(prefix));
}

describe('transformPopulation', () => {
  const result = transformPopulation(populationFixture.data, 'SDN');

  it('reads the national total from the aggregate row rather than summing', () => {
    // Summing every row in the fixture double-counts: HAPI ships the 'all'
    // aggregate alongside each gender x age-band cut of the same people.
    const naiveSum = populationFixture.data.reduce(
      (total, row) => total + (row.population ?? 0),
      0,
    );
    const total = metric(result!, 'Total population');

    expect(total?.value).toBe(47514529);
    expect(naiveSum).toBeGreaterThan(total!.value * 2);
  });

  it('labels every figure with its own unit, period and source', () => {
    for (const figure of result!.figures) {
      expect(figure.unit).toBe('people');
      expect(figure.period).toBe('2024-01-01 to 2024-12-31');
      expect(figure.source).toContain('HDX HAPI');
      expect(figure.metric).toContain('Sudan');
    }
  });

  it('produces a summary the model can quote without re-deriving provenance', () => {
    expect(result!.summary).toBe(
      'Sudan baseline population: 47,514,529 people (2024-01-01 to 2024-12-31), Common Operational Dataset baseline population via HDX HAPI.',
    );
  });

  it('warns that age bands are subsets, not additions', () => {
    expect(result!.note).toMatch(/do not add them/i);
  });
});

describe('transformFoodSecurity', () => {
  const result = transformFoodSecurity(foodSecurityFixture.data, 'SDN')!;

  it('reports only the most recent analysis period', () => {
    const periods = new Set(result.figures.map((figure) => figure.period));
    expect(periods.size).toBe(1);
    expect([...periods][0]).toMatch(/^2026-02-01/);
  });

  it('names the IPC phase rather than emitting a bare digit', () => {
    expect(metric(result, 'IPC Phase 3 (Crisis)')).toBeDefined();
    expect(metric(result, 'IPC Phase 5 (Catastrophe/Famine)')).toBeDefined();
  });

  it('converts the population fraction to a stated percentage', () => {
    // The raw field is 0.19-style; quoting it unchanged reads as 0.19% of the
    // population rather than 19%.
    const phaseThree = metric(result, 'IPC Phase 3 (Crisis)');
    expect(phaseThree?.shareOfPopulation).toMatch(/^\d+% of the population analysed$/);
  });

  it('leads with the crisis-or-worse caseload', () => {
    expect(result.summary).toMatch(
      /^Sudan: [\d,]+ people in IPC Phase 3 or above \(crisis or worse\)/,
    );
  });

  it('says the phases partition the caseload so they are not summed', () => {
    expect(result.note).toMatch(/not an additional group/i);
  });
});

describe('transformFunding', () => {
  const today = '2026-09-01';
  const result = transformFunding(fundingFixture.data, 'SDN', today)!;

  it('emits requirements, funding and coverage as separate quotable figures', () => {
    expect(metric(result, 'Requirements — Sudan Humanitarian Needs and Response Plan 2026')?.value).toBe(
      2866228593,
    );
    expect(metric(result, 'Coverage — Sudan Humanitarian Needs and Response Plan 2026')?.unit).toBe(
      'percent',
    );
  });

  it('formats large sums in the summary without losing the exact figure', () => {
    expect(result.summary).toContain('USD 2.87 billion required');
    expect(metric(result, 'Requirements')?.value).toBe(2866228593);
  });

  it('excludes forward-year pledge rows that have not started', () => {
    const starts = result.figures.map((figure) => figure.period.slice(0, 10));
    expect(starts.every((start) => start <= today)).toBe(true);
  });

  it('reports emptiness rather than a zero when nothing qualifies', () => {
    expect(transformFunding(fundingFixture.data, 'SDN', '2020-01-01')).toBeUndefined();
  });
});

describe('transformNeeds', () => {
  const result = transformNeeds(needsFixture.data, 'SDN')!;

  it('reports the sector total, never a disaggregated cut of it', () => {
    // HAPI ships "Children"/"Female"/"Disability" rows for the same sector,
    // status and period. Only the row with no category is the sector figure.
    const disaggregated = needsFixture.data.filter((row) => row.category);
    const values = new Set(result.figures.map((figure) => figure.value));
    for (const row of disaggregated) {
      if (row.population != null) expect(values.has(row.population)).toBe(false);
    }
  });

  it('surfaces the intersectoral people-in-need figure in the summary', () => {
    expect(result.summary).toBe(
      'Sudan: 33,699,770 people in need overall (intersectoral), 2026-01-01 to 2026-12-31, Humanitarian Needs and Response Plan via HDX HAPI.',
    );
  });

  it('expands the population-status code into words', () => {
    expect(metric(result, 'People in need — Food Security')).toBeDefined();
    expect(result.figures.some((figure) => figure.metric.includes('INN'))).toBe(false);
  });

  it('carries a per-figure period because sectors refresh in different cycles', () => {
    const periods = new Set(result.figures.map((figure) => figure.period));
    expect(periods.size).toBeGreaterThan(1);
  });

  it('tells the model not to sum sectors into a total', () => {
    expect(result.note).toMatch(/never sum sectors/i);
  });

  it('stays small enough for a local context window', () => {
    expect(result.figures.length).toBeLessThanOrEqual(12);
  });
});

describe('fetchHumanitarianData failure paths', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubHapi(handler: (url: string) => unknown) {
    vi.stubGlobal('fetch', async (url: string) =>
      new Response(JSON.stringify({ data: handler(url) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('explains that no global aggregate exists when no country is given', async () => {
    const result = await fetchHumanitarianData('humanitarian_needs', null);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('no_country_given');
    expect(result.guidance).toMatch(/no regional or global aggregate/i);
    expect(result.guidance).toMatch(/Global Humanitarian Overview/);
  });

  it('distinguishes an invented country code from a country with no data', async () => {
    // The exact regression from the eval transcripts: the model invents "WLD"
    // for a worldwide question and HAPI answers 200 with an empty array.
    stubHapi(() => []);

    const result = await fetchHumanitarianData('humanitarian_needs', 'WLD');

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('unknown_location');
    expect(result.guidance).toMatch(/not a country code/i);
    expect(result.guidance).toMatch(/no figure from memory|Do not substitute/i);
  });

  it('names the country when it is real but the dataset is empty', async () => {
    stubHapi((url) =>
      url.includes('/metadata/location') ? [{ code: 'TUV', name: 'Tuvalu' }] : [],
    );

    const result = await fetchHumanitarianData('food_security', 'tuv');

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('no_data_for_location');
    expect(result.guidance).toContain('Tuvalu (TUV)');
    expect(result.guidance).toMatch(/do not retry/i);
  });

  it('rejects a non-alpha-3 code without spending a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchHumanitarianData('population', 'Sudan');

    expect(result.available).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never returns an empty figure list without a reason attached', async () => {
    stubHapi(() => []);

    const result = await fetchHumanitarianData('funding', 'ZZZ');

    expect(result.figures).toHaveLength(0);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.guidance.length).toBeGreaterThan(40);
  });
});
