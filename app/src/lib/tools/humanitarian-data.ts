import { tool } from 'ai';
import { z } from 'zod';

// cost: free public API — HDX HAPI (OCHA Centre for Humanitarian Data). No key,
// no per-call charge. The app identifier below is an attribution string, not a
// secret or a credential.

const HAPI_BASE = 'https://hapi.humdata.org/api/v2';
const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 60_000;

/**
 * HAPI identifies callers with a base64 of "appname:email". It is generated
 * locally (their /encode_app_identifier endpoint does the same thing) and
 * needs no registration. Override with HDX_APP_IDENTIFIER to attribute traffic
 * to a real deployment.
 */
const DEFAULT_APP_IDENTIFIER = Buffer.from('hai-demo:demo@example.org').toString(
  'base64',
);

function appIdentifier(): string {
  return process.env.HDX_APP_IDENTIFIER || DEFAULT_APP_IDENTIFIER;
}

type Dataset = 'population' | 'food_security' | 'funding' | 'humanitarian_needs';

const ENDPOINTS: Record<Dataset, string> = {
  population: '/geography-infrastructure/baseline-population',
  food_security: '/food-security-nutrition-poverty/food-security',
  funding: '/coordination-context/funding',
  humanitarian_needs: '/affected-people/humanitarian-needs',
};

const cache = new Map<string, { expiresAt: number; value: unknown }>();

async function hapiGet<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T[]> {
  const search = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    app_identifier: appIdentifier(),
  });
  const url = `${HAPI_BASE}${path}?${search}`;

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T[];
  }

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`HDX HAPI returned ${response.status} for ${path}`);
  }

  const payload = (await response.json()) as { data?: T[] };
  const data = payload.data ?? [];
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value: data });
  return data;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

interface PeriodRow {
  reference_period_start?: string;
  reference_period_end?: string;
  location_name?: string;
}

function formatPeriod(row: PeriodRow): string {
  const start = row.reference_period_start?.slice(0, 10) ?? '?';
  const end = row.reference_period_end?.slice(0, 10) ?? '?';
  return `${start} to ${end}`;
}

/** HAPI has no sort parameter, so recency is resolved client-side. */
function latestPeriodStart(rows: PeriodRow[]): string | undefined {
  return rows.reduce<string | undefined>((latest, row) => {
    const start = row.reference_period_start;
    if (!start) return latest;
    return !latest || start > latest ? start : latest;
  }, undefined);
}

function isoYearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

interface PopulationRow extends PeriodRow {
  gender?: string | null;
  age_range?: string | null;
  population?: number;
}

async function getPopulation(iso3: string) {
  const rows = await hapiGet<PopulationRow>(ENDPOINTS.population, {
    location_code: iso3,
    admin_level: 0,
    limit: 200,
  });
  if (rows.length === 0) return { dataset: 'population', rows: [] };

  const latest = latestPeriodStart(rows);
  const current = rows.filter((row) => row.reference_period_start === latest);

  const total = current.reduce((sum, row) => sum + (row.population ?? 0), 0);
  const byGender = current.reduce<Record<string, number>>((acc, row) => {
    const key = row.gender ?? 'unspecified';
    acc[key] = (acc[key] ?? 0) + (row.population ?? 0);
    return acc;
  }, {});

  return {
    dataset: 'population',
    location: current[0]?.location_name ?? iso3,
    referencePeriod: formatPeriod(current[0] ?? {}),
    totalPopulation: total,
    byGender,
    note: 'Baseline population, national level. Gender keys: f = female, m = male.',
  };
}

interface FoodSecurityRow extends PeriodRow {
  ipc_phase?: string;
  ipc_type?: string;
  population_in_phase?: number;
  population_fraction_in_phase?: number;
}

async function getFoodSecurity(iso3: string) {
  const rows = await hapiGet<FoodSecurityRow>(ENDPOINTS.food_security, {
    location_code: iso3,
    admin_level: 0,
    ipc_type: 'current',
    start_date: isoYearsAgo(2),
    limit: 100,
  });
  if (rows.length === 0) return { dataset: 'food_security', phases: [] };

  const latest = latestPeriodStart(rows);
  const current = rows
    .filter((row) => row.reference_period_start === latest)
    .sort((a, b) => (a.ipc_phase ?? '').localeCompare(b.ipc_phase ?? ''));

  return {
    dataset: 'food_security',
    location: current[0]?.location_name ?? iso3,
    referencePeriod: formatPeriod(current[0] ?? {}),
    phases: current.map((row) => ({
      ipcPhase: row.ipc_phase,
      populationInPhase: row.population_in_phase,
      shareOfPopulation: row.population_fraction_in_phase,
    })),
    note: 'IPC acute food insecurity, current-period classification, national level. Phase 3+ is crisis or worse.',
  };
}

interface FundingRow extends PeriodRow {
  appeal_name?: string;
  appeal_type?: string;
  requirements_usd?: number;
  funding_usd?: number;
  funding_pct?: number;
}

async function getFunding(iso3: string) {
  const rows = await hapiGet<FundingRow>(ENDPOINTS.funding, {
    location_code: iso3,
    start_date: isoYearsAgo(2),
    limit: 50,
  });

  const appeals = rows
    .sort((a, b) =>
      (b.reference_period_start ?? '').localeCompare(a.reference_period_start ?? ''),
    )
    .slice(0, 6)
    .map((row) => ({
      appeal: row.appeal_name,
      type: row.appeal_type,
      requirementsUsd: row.requirements_usd,
      fundedUsd: row.funding_usd,
      fundedPercent: row.funding_pct,
      referencePeriod: formatPeriod(row),
    }));

  return {
    dataset: 'funding',
    location: rows[0]?.location_name ?? iso3,
    appeals,
    note: 'Appeal requirements and funding received, from OCHA FTS via HDX HAPI. Figures are cumulative for the appeal period and move during the year.',
  };
}

interface NeedsRow extends PeriodRow {
  sector_name?: string;
  sector_code?: string;
  population_status?: string;
  population?: number;
}

const POPULATION_STATUS_LABELS: Record<string, string> = {
  INN: 'in need',
  TGT: 'targeted',
  AFF: 'affected',
  REA: 'reached',
};

async function getHumanitarianNeeds(iso3: string) {
  const rows = await hapiGet<NeedsRow>(ENDPOINTS.humanitarian_needs, {
    location_code: iso3,
    admin_level: 0,
    start_date: isoYearsAgo(2),
    limit: 300,
  });
  if (rows.length === 0) return { dataset: 'humanitarian_needs', sectors: [] };

  const latest = latestPeriodStart(rows);
  const current = rows.filter((row) => row.reference_period_start === latest);

  return {
    dataset: 'humanitarian_needs',
    location: current[0]?.location_name ?? iso3,
    referencePeriod: formatPeriod(current[0] ?? {}),
    sectors: current
      .map((row) => ({
        sector: row.sector_name ?? row.sector_code,
        status:
          POPULATION_STATUS_LABELS[row.population_status ?? ''] ??
          row.population_status,
        population: row.population,
      }))
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 25),
    note: 'People in need / targeted by sector, from the Humanitarian Needs and Response Plan via HDX HAPI.',
  };
}

const HANDLERS: Record<Dataset, (iso3: string) => Promise<unknown>> = {
  population: getPopulation,
  food_security: getFoodSecurity,
  funding: getFunding,
  humanitarian_needs: getHumanitarianNeeds,
};

export const humanitarianDataTool = tool({
  description:
    'Look up quantitative humanitarian indicators for a country from HDX HAPI (OCHA Centre for Humanitarian Data): baseline population, IPC acute food insecurity phases, appeal funding against requirements, and people in need by sector. Use this whenever a question needs a current figure for a country, rather than recalling one. Every result carries its reference period — always report that period alongside the figure.',
  inputSchema: z.object({
    country_iso3: z
      .string()
      .length(3)
      .describe(
        'ISO 3166-1 alpha-3 country code, uppercase — e.g. SDN for Sudan, COD for the Democratic Republic of the Congo, AFG for Afghanistan.',
      ),
    dataset: z
      .enum(['population', 'food_security', 'funding', 'humanitarian_needs'])
      .describe(
        'Which indicator to retrieve. Call the tool more than once to combine datasets.',
      ),
  }),
  execute: async ({ country_iso3, dataset }) => {
    const iso3 = country_iso3.toUpperCase();
    try {
      return await HANDLERS[dataset as Dataset](iso3);
    } catch (error) {
      return {
        dataset,
        country_iso3: iso3,
        error: `Could not reach HDX HAPI: ${
          error instanceof Error ? error.message : 'unknown error'
        }. Fall back to ReliefWeb situation reports via crisis_updates, and tell the user the structured figures were unavailable rather than substituting remembered ones.`,
      };
    }
  },
});
