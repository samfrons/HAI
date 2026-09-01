// cost: free public API — World Bank open data. No key, no per-call charge.
//
// Ported from claude/platform-features-data-depth-euiakz (src/hai/connectors/worldbank.py).

const API_URL = 'https://api.worldbank.org/v2/country/{country}/indicator/{indicator}';
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'HAI/1.0 (humanitarian operations assistant)';

/** Indicators change at most annually; this is a burst guard, not a freshness window. */
const CACHE_TTL_MS = 300_000;

/** Indicators most relevant to humanitarian context analysis. */
export const CONTEXT_INDICATORS: Record<string, string> = {
  'SP.POP.TOTL': 'Population, total',
  'SP.DYN.LE00.IN': 'Life expectancy at birth (years)',
  'SH.STA.MMRT': 'Maternal mortality ratio (per 100,000 live births)',
  'SN.ITK.DEFC.ZS': 'Prevalence of undernourishment (% of population)',
  'SH.H2O.BASW.ZS': 'People using at least basic drinking water services (%)',
  'SM.POP.REFG': 'Refugee population by country of asylum',
  'NY.GDP.PCAP.CD': 'GDP per capita (current US$)',
  'SI.POV.DDAY': 'Poverty headcount at $2.15/day (%)',
};

export interface WorldBankIndicatorValue {
  source: 'World Bank';
  indicator: string;
  name: string | null;
  country: string | null;
  year: string | null;
  value: number | null;
}

interface WorldBankRow {
  indicator?: { value?: string | null };
  country?: { value?: string | null };
  date?: string | null;
  value?: number | null;
}

const cache = new Map<string, { expiresAt: number; value: WorldBankIndicatorValue | null }>();

function readCache(key: string): { hit: true; value: WorldBankIndicatorValue | null } | { hit: false } {
  const entry = cache.get(key);
  if (!entry) return { hit: false };
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return { hit: false };
  }
  return { hit: true, value: entry.value };
}

export function normalizeIndicator(
  result: unknown,
  indicator: string,
): WorldBankIndicatorValue | null {
  if (!Array.isArray(result) || result.length < 2 || !result[1]) return null;
  const rows = result[1] as WorldBankRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    source: 'World Bank',
    indicator,
    name: row.indicator?.value ?? null,
    country: row.country?.value ?? null,
    year: row.date ?? null,
    value: row.value ?? null,
  };
}

/** Most recent non-empty value for one indicator, or null. */
export async function fetchIndicator(
  countryIso3: string,
  indicator: string,
): Promise<WorldBankIndicatorValue | null> {
  const cacheKey = `${countryIso3}::${indicator}`;
  const cached = readCache(cacheKey);
  if (cached.hit) return cached.value;

  const url = `${API_URL.replace('{country}', countryIso3).replace('{indicator}', indicator)}?format=json&mrnev=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`World Bank API returned ${response.status} for ${indicator}`);
  }

  const result = normalizeIndicator(await response.json(), indicator);
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}

/** Humanitarian context profile: latest values for every CONTEXT_INDICATORS code.
 * Mirrors the Python connector's per-indicator degradation (one indicator
 * failing does not fail the whole profile), fetched concurrently rather than
 * the original's sequential loop — eight round trips in series would eat too
 * much of the tool-loop time budget. */
export async function fetchCountryContext(
  countryIso3: string,
): Promise<WorldBankIndicatorValue[]> {
  const settled = await Promise.allSettled(
    Object.keys(CONTEXT_INDICATORS).map((code) => fetchIndicator(countryIso3, code)),
  );
  return settled
    .filter(
      (result): result is PromiseFulfilledResult<WorldBankIndicatorValue | null> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value)
    .filter((row): row is WorldBankIndicatorValue => row !== null && row.value !== null);
}
