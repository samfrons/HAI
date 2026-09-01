import { XMLParser } from 'fast-xml-parser';

// cost: free public API — GDACS (EC/UN Global Disaster Alert and Coordination
// System) RSS feed. No key, no per-call charge.
//
// Ported from claude/platform-features-data-depth-euiakz (src/hai/connectors/gdacs.py).
// The Python version filters `country` by substring on the free-text country
// field; this version also accepts an exact `countryIso3` match against the
// feed's own `gdacs:iso3` tag, which the app's tools address countries by.

const RSS_URL = 'https://www.gdacs.org/xml/rss.xml';
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'HAI/1.0 (humanitarian operations assistant)';

/**
 * GDACS serves the feed as `Content-Type: application/xml` and runs strict
 * content negotiation: a request whose `Accept` does not admit that exact type
 * is answered `406 Not Acceptable`, with no body to explain why. Asking for the
 * semantically-correct `application/rss+xml` alone — which is what this
 * connector did — is therefore rejected outright, as is `text/xml`.
 *
 * Verified against the live endpoint (identical User-Agent throughout):
 *   Accept: application/rss+xml                       -> 406
 *   Accept: text/xml                                  -> 406
 *   Accept: application/xml                           -> 200
 *   Accept: rss+xml then application/xml then wildcard  -> 200
 *
 * The failure never showed up in the test suite because the tests stub `fetch`,
 * and it is not IP- or User-Agent-dependent, so keep the wildcard fallback: it
 * is what makes the header survive GDACS changing the type it serves.
 */
const ACCEPT_RSS = 'application/rss+xml, application/xml;q=0.9, */*;q=0.8';

/** RSS updates on the order of hours; this only guards a single tool-loop burst. */
const CACHE_TTL_MS = 180_000;

const EVENT_TYPES: Record<string, string> = {
  EQ: 'Earthquake',
  TC: 'Tropical Cyclone',
  FL: 'Flood',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
  TS: 'Tsunami',
};

const ALERT_LEVEL_ORDER: Record<string, number> = { green: 0, orange: 1, red: 2 };
export type AlertLevel = keyof typeof ALERT_LEVEL_ORDER;

export interface GdacsAlert {
  source: 'GDACS';
  eventId: string | null;
  eventType: string;
  alertLevel: string;
  title: string | null;
  country: string | null;
  countryIso3: string | null;
  fromDate: string | null;
  toDate: string | null;
  severity: string | null;
  population: string | null;
  link: string | null;
}

interface GdacsItem {
  title?: string;
  link?: string;
  eventtype?: string;
  alertlevel?: string;
  country?: string;
  iso3?: string;
  eventid?: string | number;
  fromdate?: string;
  todate?: string;
  severity?: string | { '#text'?: string };
  population?: string | { '#text'?: string };
}

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

const cache = new Map<string, { expiresAt: number; value: GdacsAlert[] }>();

function readCache(key: string): GdacsAlert[] | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function textOf(value: string | { '#text'?: string } | undefined): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : (value['#text'] ?? null);
}

export interface GdacsFilters {
  minLevel?: AlertLevel;
  /** Substring match against the feed's free-text country field. */
  country?: string;
  /** Exact match (case-insensitive) against the feed's ISO3 country code. */
  countryIso3?: string;
}

export function normalizeAlerts(
  doc: { rss?: { channel?: { item?: GdacsItem | GdacsItem[] } } },
  { minLevel = 'green', country, countryIso3 }: GdacsFilters = {},
): GdacsAlert[] {
  if (!(minLevel in ALERT_LEVEL_ORDER)) {
    throw new Error('minLevel must be green, orange, or red');
  }
  const threshold = ALERT_LEVEL_ORDER[minLevel];

  const rawItems = doc.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const alerts: GdacsAlert[] = [];
  for (const item of items) {
    const level = (item.alertlevel ?? 'green').toLowerCase();
    if ((ALERT_LEVEL_ORDER[level] ?? 0) < threshold) continue;

    const itemCountry = item.country ?? '';
    if (country && !itemCountry.toLowerCase().includes(country.toLowerCase())) continue;

    const itemIso3 = item.iso3 ?? null;
    if (countryIso3 && itemIso3?.toUpperCase() !== countryIso3.toUpperCase()) continue;

    const etype = item.eventtype ?? '';
    alerts.push({
      source: 'GDACS',
      eventId: item.eventid != null ? String(item.eventid) : null,
      eventType: EVENT_TYPES[etype] ?? etype,
      alertLevel: level,
      title: item.title ?? null,
      country: item.country ?? null,
      countryIso3: itemIso3,
      fromDate: item.fromdate ?? null,
      toDate: item.todate ?? null,
      severity: textOf(item.severity),
      population: textOf(item.population),
      link: item.link ?? null,
    });
  }
  alerts.sort((a, b) => (ALERT_LEVEL_ORDER[b.alertLevel] ?? 0) - (ALERT_LEVEL_ORDER[a.alertLevel] ?? 0));
  return alerts;
}

export async function fetchAlerts(filters: GdacsFilters = {}): Promise<GdacsAlert[]> {
  const minLevel = filters.minLevel ?? 'green';
  if (!(minLevel in ALERT_LEVEL_ORDER)) {
    throw new Error('minLevel must be green, orange, or red');
  }

  const cacheKey = `${minLevel}::${filters.country ?? ''}::${filters.countryIso3 ?? ''}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const response = await fetch(RSS_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT_RSS },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GDACS feed returned ${response.status}`);
  }

  const xmlText = await response.text();
  const doc = parser.parse(xmlText) as { rss?: { channel?: { item?: GdacsItem | GdacsItem[] } } };
  const alerts = normalizeAlerts(doc, filters);
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: alerts });
  return alerts;
}
