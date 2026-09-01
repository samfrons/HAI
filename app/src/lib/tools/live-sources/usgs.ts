// cost: free public API — USGS real-time earthquake feeds. No key, no per-call charge.
//
// Ported from claude/platform-features-data-depth-euiakz (src/hai/connectors/usgs.py).

const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{feed}.geojson';
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'HAI/1.0 (humanitarian operations assistant)';

/** In-memory cache: earthquake feeds refresh continuously upstream, so this only
 * stops a single multi-step tool loop from refetching the same feed. */
const CACHE_TTL_MS = 120_000;

export const USGS_FEEDS = {
  significant_week: 'Significant earthquakes, past 7 days',
  significant_month: 'Significant earthquakes, past 30 days',
  '4.5_day': 'M4.5+ earthquakes, past 24 hours',
  '4.5_week': 'M4.5+ earthquakes, past 7 days',
} as const;

export type UsgsFeed = keyof typeof USGS_FEEDS;

export interface EarthquakeEvent {
  source: 'USGS';
  id: string | null;
  magnitude: number;
  place: string | null;
  timeMs: number | null;
  /** True if a tsunami warning is associated with this event. */
  tsunami: boolean;
  /** PAGER alert level: green, yellow, orange, red — or null if not assessed. */
  alert: string | null;
  feltReports: number | null;
  longitude: number | null;
  latitude: number | null;
  depthKm: number | null;
  url: string | null;
}

interface UsgsFeature {
  id?: string;
  properties?: {
    mag?: number | null;
    place?: string | null;
    time?: number | null;
    tsunami?: number | boolean | null;
    alert?: string | null;
    felt?: number | null;
    url?: string | null;
  };
  geometry?: {
    coordinates?: Array<number | null>;
  } | null;
}

const cache = new Map<string, { expiresAt: number; value: EarthquakeEvent[] }>();

function readCache(key: string): EarthquakeEvent[] | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

export function normalizeEarthquakes(
  data: { features?: UsgsFeature[] },
  minMagnitude: number,
): EarthquakeEvent[] {
  const events: EarthquakeEvent[] = [];
  for (const feat of data.features ?? []) {
    const props = feat.properties ?? {};
    const coords = feat.geometry?.coordinates ?? [null, null, null];
    const mag = props.mag ?? null;
    if (mag === null || mag < minMagnitude) continue;
    events.push({
      source: 'USGS',
      id: feat.id ?? null,
      magnitude: mag,
      place: props.place ?? null,
      timeMs: props.time ?? null,
      tsunami: Boolean(props.tsunami),
      alert: props.alert ?? null,
      feltReports: props.felt ?? null,
      longitude: coords[0] ?? null,
      latitude: coords[1] ?? null,
      depthKm: coords[2] ?? null,
      url: props.url ?? null,
    });
  }
  events.sort((a, b) => b.magnitude - a.magnitude);
  return events;
}

export async function fetchEarthquakes(
  feed: UsgsFeed = 'significant_week',
  minMagnitude = 0,
): Promise<EarthquakeEvent[]> {
  if (!(feed in USGS_FEEDS)) {
    throw new Error(`unknown feed "${feed}"; choose from ${Object.keys(USGS_FEEDS).sort().join(', ')}`);
  }

  const cacheKey = `${feed}::${minMagnitude}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const response = await fetch(FEED_URL.replace('{feed}', feed), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`USGS feed "${feed}" returned ${response.status}`);
  }

  const data = (await response.json()) as { features?: UsgsFeature[] };
  const events = normalizeEarthquakes(data, minMagnitude);
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: events });
  return events;
}
