import { afterEach, describe, expect, it, vi } from 'vitest';

import fixture from './__fixtures__/usgs-4.5_week.json';
import { fetchEarthquakes, normalizeEarthquakes } from './usgs';

/**
 * Fixture is a real USGS `4.5_week.geojson` response trimmed to three
 * features: one with a PAGER alert, one below M5, one above M5 without an
 * alert — enough to exercise magnitude filtering and sorting.
 */

describe('normalizeEarthquakes', () => {
  it('drops events below the magnitude floor and sorts by magnitude descending', () => {
    const events = normalizeEarthquakes(fixture, 5.0);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.magnitude)).toEqual([5.6, 5.3]);
  });

  it('carries the PAGER alert level and geometry through unchanged', () => {
    const events = normalizeEarthquakes(fixture, 5.0);
    const alerted = events.find((e) => e.alert !== null);
    expect(alerted?.alert).toBe('green');
    expect(alerted?.source).toBe('USGS');
    expect(typeof alerted?.depthKm).toBe('number');
  });

  it('keeps everything when the magnitude floor is zero', () => {
    expect(normalizeEarthquakes(fixture, 0)).toHaveLength(3);
  });

  it('treats a feature with no coordinates as null island rather than throwing', () => {
    const events = normalizeEarthquakes({ features: [{ properties: { mag: 6 } }] }, 0);
    expect(events[0].longitude).toBeNull();
    expect(events[0].latitude).toBeNull();
    expect(events[0].depthKm).toBeNull();
  });
});

describe('fetchEarthquakes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an unknown feed without making a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(fetchEarthquakes('bogus_feed' as never)).rejects.toThrow(/unknown feed/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws with the feed name and status on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    await expect(fetchEarthquakes('significant_week')).rejects.toThrow(/503/);
  });

  it('parses a live-shaped response end to end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
    const events = await fetchEarthquakes('4.5_week', 5.0);
    expect(events).toHaveLength(2);
  });
});
