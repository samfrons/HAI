import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { XMLParser } from 'fast-xml-parser';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAlerts, normalizeAlerts } from './gdacs';

/**
 * Fixture is six items trimmed from a live GDACS RSS pull: one per event type
 * seen (TC, EQ, FL, WF, DR) plus a second EQ at orange level, covering the
 * level threshold and country/iso3 filters. No red-level item was live at
 * capture time, so the red threshold is covered synthetically below.
 */
const rssPath = join(__dirname, '__fixtures__', 'gdacs-rss.xml');
const rssText = readFileSync(rssPath, 'utf-8');
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
const fixtureDoc = parser.parse(rssText) as Parameters<typeof normalizeAlerts>[0];

describe('normalizeAlerts', () => {
  it('defaults to green and includes every item', () => {
    expect(normalizeAlerts(fixtureDoc)).toHaveLength(6);
  });

  it('filters by minimum alert level and sorts most severe first', () => {
    const orangeUp = normalizeAlerts(fixtureDoc, { minLevel: 'orange' });
    expect(orangeUp).toHaveLength(1);
    expect(orangeUp[0].alertLevel).toBe('orange');
    expect(orangeUp[0].eventType).toBe('Earthquake');
  });

  it('excludes everything above the highest level present', () => {
    expect(normalizeAlerts(fixtureDoc, { minLevel: 'red' })).toHaveLength(0);
  });

  it('filters by country substring, case-insensitively', () => {
    const hits = normalizeAlerts(fixtureDoc, { country: 'mexico' });
    expect(hits).toHaveLength(1);
    expect(hits[0].eventType).toBe('Tropical Cyclone');
  });

  it('filters by exact ISO3 match rather than substring', () => {
    const hits = normalizeAlerts(fixtureDoc, { countryIso3: 'ind' });
    expect(hits).toHaveLength(1);
    expect(hits[0].country).toBe('India');
    // "IND" must not also match "Indonesia" the way a substring match would.
    expect(normalizeAlerts(fixtureDoc, { countryIso3: 'IND' }).every((a) => a.countryIso3 === 'IND')).toBe(
      true,
    );
  });

  it('rejects an invalid minLevel', () => {
    expect(() => normalizeAlerts(fixtureDoc, { minLevel: 'purple' as never })).toThrow(
      /green, orange, or red/,
    );
  });

  it('handles a feed with exactly one item without crashing on the array/object shape', () => {
    const items = fixtureDoc.rss!.channel!.item;
    const firstItem = Array.isArray(items) ? items[0] : items;
    const oneItemDoc = { rss: { channel: { item: firstItem } } };
    expect(normalizeAlerts(oneItemDoc)).toHaveLength(1);
  });
});

describe('fetchAlerts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws with the status on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(fetchAlerts()).rejects.toThrow(/500/);
  });

  it('parses a live-shaped RSS response end to end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(rssText, { status: 200 })),
    );
    const alerts = await fetchAlerts({ minLevel: 'red', country: 'nowhere-cache-buster' });
    expect(alerts).toHaveLength(0);
  });

  /**
   * Regression. GDACS answers `406 Not Acceptable` to `Accept:
   * application/rss+xml` on its own — the header this connector shipped with —
   * because it serves the feed as `application/xml`. Every deployed fetch
   * failed while this suite stayed green, since the suite stubs `fetch` and
   * never looked at what was sent. So look at what is sent.
   */
  it('asks for a media type GDACS will actually serve, and identifies itself', async () => {
    const sent: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (...args: [string, RequestInit?]) => {
        if (args[1]) sent.push(args[1]);
        return new Response(rssText, { status: 200 });
      }),
    );

    await fetchAlerts({ minLevel: 'red', country: 'nowhere-header-check' });

    const headers = sent[0].headers as Record<string, string>;
    expect(headers.Accept).toContain('application/xml');
    expect(headers.Accept).toContain('*/*');
    expect(headers['User-Agent']).toContain('HAI/');
  });
});
