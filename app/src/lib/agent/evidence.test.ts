import { describe, expect, it } from 'vitest';

import { formatEvidence, harvest, summariseArgs, summariseResult } from './evidence';

function counter() {
  let n = 0;
  return () => `e${++n}`;
}

describe('harvest', () => {
  it('reads retrieved passages into labelled, citable evidence', () => {
    const result = harvest(
      'search_standards',
      {
        query: 'water quantity',
        chunks: [
          {
            source: 'sphere',
            section: 'Water supply standard 2.1',
            text: 'The minimum water quantity is 15 litres per person per day.',
          },
        ],
      },
      counter(),
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'e1',
      tool: 'search_standards',
      label: 'sphere · Water supply standard 2.1',
    });
    expect(result.items[0].text).toContain('15 litres');
  });

  /*
   * The registry is under active extension, so the harvester probes shapes
   * rather than switching on tool name. This is the guard on that: a tool the
   * engine has never heard of, returning fields it has never seen, still
   * produces usable evidence rather than being dropped.
   */
  it('reads a tool it has no knowledge of', () => {
    const result = harvest(
      'some_future_tool',
      {
        readings: [
          { title: 'River gauge', date: '2026-08-01', level_m: 7.4, station: 'Khartoum' },
        ],
      },
      counter(),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].label).toBe('River gauge · 2026-08-01');
    expect(result.items[0].text).toContain('level_m: 7.4');
  });

  it('records a per-source errors list as degradation, not as evidence', () => {
    const result = harvest(
      'hazards_context',
      {
        scope: 'country',
        gdacsAlerts: [
          { source: 'GDACS', eventType: 'Flood', alertLevel: 'orange', title: 'Flood in Sudan' },
        ],
        countryContext: [],
        errors: ['worldbank: HTTP 503', 'hpc: no plan published for 2026'],
      },
      counter(),
    );

    expect(result.errors).toEqual([
      { source: 'hazards_context · worldbank', message: 'HTTP 503' },
      { source: 'hazards_context · hpc', message: 'no plan published for 2026' },
    ]);
    // The failures must not become citable facts; the alert that did arrive must.
    expect(result.items).toHaveLength(1);
    expect(result.items[0].text).toContain('Flood in Sudan');
    expect(result.items.some((item) => item.text.includes('HTTP 503'))).toBe(false);
  });

  /*
   * The real shapes from `tools/live-sources/*`, which map their upstream feeds
   * into camelCase TypeScript interfaces rather than the snake_case the
   * HDX-backed tools return. Before the qualifier list covered both, every GDACS
   * alert in a brief labelled as the bare word "GDACS", so three different
   * floods cited identically and the reader could not tell them apart.
   */
  it('labels a GDACS alert by its hazard, not just its publisher', () => {
    const result = harvest(
      'hazards_context',
      {
        scope: 'country',
        gdacsAlerts: [
          {
            source: 'GDACS',
            eventType: 'Flood',
            alertLevel: 'orange',
            title: 'Flood in Sudan',
            country: 'Sudan',
            fromDate: '2026-08-20',
          },
        ],
        errors: [],
      },
      counter(),
    );

    expect(result.items[0].label).toBe('GDACS · Flood');
    expect(result.items[0].text).toContain('orange');
  });

  it('labels an OCHA response plan by its name', () => {
    const result = harvest(
      'hazards_context',
      {
        scope: 'global',
        responsePlans: [
          { source: 'OCHA HPC', id: 1234, name: 'Sudan Humanitarian Response Plan 2026', code: 'HSDN26' },
        ],
        errors: [],
      },
      counter(),
    );

    expect(result.items[0].label).toBe('OCHA HPC · Sudan Humanitarian Response Plan 2026');
    // The name is spent on the label, so it is not repeated inside the body.
    expect(result.items[0].text).not.toContain('Sudan Humanitarian Response Plan 2026');
  });

  it('labels a World Bank indicator by its reference year', () => {
    const result = harvest(
      'hazards_context',
      {
        scope: 'country',
        countryContext: [
          { source: 'World Bank', indicator: 'SP.POP.TOTL', name: 'Population, total', country: 'Sudan', year: '2025', value: 51662147 },
        ],
        errors: [],
      },
      counter(),
    );

    expect(result.items[0].label).toBe('World Bank · 2025');
    expect(result.items[0].text).toContain('51662147');
  });

  /*
   * Seen on the live Sudan brief: `hazards_context` was asked for `hpc` at
   * country scope, where that source does not apply, and returned an envelope
   * with no data and no errors. The single-record fallback turned it into a
   * citable item reading "scope: country; generatedAt: …" — a fact about the
   * request, handed to a model under instructions to cite what it is given.
   */
  it('does not turn an empty result envelope into evidence', () => {
    const result = harvest(
      'hazards_context',
      {
        scope: 'country',
        countryIso3: 'SDN',
        generatedAt: '2026-09-01T13:50:00.000Z',
        errors: [],
      },
      counter(),
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('treats an unavailable dataset as a source error with no evidence', () => {
    const result = harvest(
      'humanitarian_data',
      { available: false, reason: 'no_coverage', detail: 'HAPI holds no funding data for SDN.' },
      counter(),
    );

    expect(result.items).toEqual([]);
    expect(result.errors[0].message).toBe('HAPI holds no funding data for SDN.');
  });

  it('treats an empty-retrieval notice as a source error', () => {
    const result = harvest(
      'search_standards',
      { query: 'blockchain', chunks: [], notice: 'No passages matched this query.' },
      counter(),
    );

    expect(result.items).toEqual([]);
    expect(result.errors[0].message).toBe('No passages matched this query.');
  });
});

describe('summaries', () => {
  it('describes a result by count and source, never by content', () => {
    const harvested = harvest(
      'search_standards',
      {
        chunks: [
          { source: 'sphere', section: '2.1', text: 'a' },
          { source: 'chs', section: '4', text: 'b' },
        ],
      },
      counter(),
    );
    expect(summariseResult(harvested)).toBe('2 records — sphere, chs');
  });

  it('reports the failure when a result carried only one', () => {
    const harvested = harvest('crisis_updates', { updates: [], error: 'feed unreachable' }, counter());
    expect(summariseResult(harvested)).toBe('feed unreachable');
  });

  it('flattens tool arguments to one readable line', () => {
    expect(summariseArgs({ country_iso3: 'SDN', dataset: 'funding', unset: undefined })).toBe(
      'country_iso3=SDN dataset=funding',
    );
  });
});

describe('formatEvidence', () => {
  it('numbers evidence so a draft can cite it', () => {
    const { items } = harvest(
      'search_standards',
      { chunks: [{ source: 'sphere', section: '2.1', text: '15 litres per person per day' }] },
      counter(),
    );
    expect(formatEvidence(items)).toBe(
      '[e1] sphere · 2.1: 15 litres per person per day',
    );
  });

  it('says so rather than going blank when nothing was retrieved', () => {
    expect(formatEvidence([])).toContain('no evidence');
  });

  it('caps the digest so one section cannot spend the whole token budget', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      id: `e${index}`,
      tool: 't',
      label: 'source',
      text: 'x'.repeat(200),
    }));
    expect(formatEvidence(items, 1_000).length).toBeLessThanOrEqual(1_000);
  });
});
