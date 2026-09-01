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
        gdacsAlerts: [{ event_type: 'Flood', alert_level: 'orange', title: 'Flood in Sudan' }],
        countryContext: [],
        errors: ['worldbank: HTTP 503', 'hpc: no plan published for 2026'],
      },
      counter(),
    );

    expect(result.errors).toEqual([
      { source: 'hazards_context · worldbank', message: 'HTTP 503' },
      { source: 'hazards_context · hpc', message: 'no plan published for 2026' },
    ]);
    // The failures must not become citable facts.
    expect(result.items).toHaveLength(1);
    expect(result.items[0].label).toBe('Flood in Sudan · orange');
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
