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

const SOURCES: Record<Dataset, string> = {
  population: 'Common Operational Dataset baseline population via HDX HAPI',
  food_security: 'IPC acute food insecurity via HDX HAPI',
  funding: 'OCHA Financial Tracking Service via HDX HAPI',
  humanitarian_needs: 'Humanitarian Needs and Response Plan via HDX HAPI',
};

/* ------------------------------------------------------------------ *
 * Result shape
 * ------------------------------------------------------------------ */

/**
 * One quotable number. The model reads tool output as text, so every figure
 * carries its own label, unit, period and source rather than inheriting them
 * from a surrounding object — a figure lifted out of a nested structure loses
 * exactly the provenance the system prompt requires it to state.
 */
export interface Figure {
  metric: string;
  value: number;
  unit: 'people' | 'USD' | 'percent';
  period: string;
  source: string;
  /** Only where the upstream dataset publishes one, e.g. IPC phase shares. */
  shareOfPopulation?: string;
}

export interface DataResult {
  dataset: Dataset;
  available: true;
  location: string;
  /** A sentence the model can quote verbatim without re-deriving provenance. */
  summary: string;
  figures: Figure[];
  note: string;
}

export type UnavailableReason =
  | 'no_country_given'
  | 'unknown_location'
  | 'no_data_for_location'
  | 'upstream_error';

export interface UnavailableResult {
  dataset: Dataset;
  available: false;
  reason: UnavailableReason;
  figures: [];
  /** Written for the model to act on, not for a developer to debug. */
  guidance: string;
}

export type HumanitarianDataResult = DataResult | UnavailableResult;

/**
 * Every failure path returns this shape rather than an empty collection.
 *
 * The eval transcripts that motivated it (`339m_needs_001`,
 * `financial_tracking_001`) show why: asked a global question, the model called
 * this tool with a null country, got a raw schema-validation error, retried
 * with an invented "WLD" code, and received `{ sectors: [] }` — HAPI answers 200
 * with an empty array for any unrecognised location, so nothing in the result
 * distinguished "this code is not a country" from "this country has no data".
 * With no signal to act on, the model dropped the tool and answered from memory.
 * A named reason plus an instruction is the difference between a dead end and a
 * usable one.
 */
/**
 * `detail` is the operator-readable cause; `guidance` is what the model should
 * do about it. Keeping them apart matters because they have different readers:
 * `evidence.ts` puts `detail` in the trace and the document's caveats, where a
 * humanitarian analyst reads it, while `guidance` is instruction prose that
 * would be nonsense there.
 *
 * Without a `detail` the trace fell back to the bare `reason`, so every one of
 * these surfaced as the single word "upstream_error" — which is what made a
 * live failure of this source, visible only from the deployed environment,
 * almost impossible to diagnose from the trace it produced.
 */
function unavailable(
  dataset: Dataset,
  reason: UnavailableReason,
  guidance: string,
  detail?: string,
): UnavailableResult {
  return { dataset, available: false, reason, figures: [], guidance, ...(detail ? { detail } : {}) };
}

const NO_SUBSTITUTE =
  'Tell the user this figure could not be verified and say why. Do not substitute a figure from memory.';

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
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HAI/1.0 (humanitarian operations assistant)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/**
 * Only called when a query came back empty, so the happy path pays nothing for
 * it. HAPI does not reject an unknown `location_code` — it returns an empty
 * array — so this is the only way to tell a made-up code from a real country
 * that simply has no rows in the requested dataset.
 */
async function locationName(iso3: string): Promise<string | undefined> {
  try {
    const rows = await hapiGet<{ code?: string; name?: string }>(
      '/metadata/location',
      { code: iso3 },
    );
    return rows.find((row) => row.code === iso3)?.name;
  } catch {
    return undefined;
  }
}

async function explainEmpty(
  dataset: Dataset,
  iso3: string,
): Promise<UnavailableResult> {
  const name = await locationName(iso3);
  if (!name) {
    return unavailable(
      dataset,
      'unknown_location',
      `"${iso3}" is not a country code HDX HAPI recognises. HAPI is organised by country: it holds no regional or global aggregate, so there is no code that returns a worldwide total. Retry with a valid ISO 3166-1 alpha-3 code if the user asked about a specific country. ${NO_SUBSTITUTE}`,
    );
  }
  return unavailable(
    dataset,
    'no_data_for_location',
    `HDX HAPI recognises ${name} (${iso3}) but has no ${dataset.replace('_', ' ')} rows for it. Do not retry the same call. ${NO_SUBSTITUTE}`,
  );
}

/* ------------------------------------------------------------------ *
 * Shared row helpers
 * ------------------------------------------------------------------ */

interface PeriodRow {
  reference_period_start?: string | null;
  reference_period_end?: string | null;
  location_name?: string | null;
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

function count(value: number): string {
  return value.toLocaleString('en-US');
}

function usd(value: number): string {
  if (value >= 1e9) return `USD ${(value / 1e9).toFixed(2)} billion`;
  if (value >= 1e6) return `USD ${(value / 1e6).toFixed(1)} million`;
  return `USD ${count(Math.round(value))}`;
}

/* ------------------------------------------------------------------ *
 * Transformations — pure, so they can be tested against captured fixtures
 * ------------------------------------------------------------------ */

interface PopulationRow extends PeriodRow {
  gender?: string | null;
  age_range?: string | null;
  min_age?: number | null;
  population?: number | null;
}

export function transformPopulation(
  rows: PopulationRow[],
  iso3: string,
): DataResult | undefined {
  if (rows.length === 0) return undefined;

  const latest = latestPeriodStart(rows);
  const current = rows.filter((row) => row.reference_period_start === latest);

  // HAPI returns the aggregate rows ('all') alongside every gender x age-band
  // breakdown of the same people. Summing the response double-counts several
  // times over, so read the aggregates rather than adding rows up.
  const totals = current.filter((row) => row.age_range === 'all');
  const total = totals.find((row) => row.gender === 'all')?.population;

  const location = current[0]?.location_name ?? iso3;
  const period = formatPeriod(current[0] ?? {});
  const source = SOURCES.population;

  const figures: Figure[] = [];
  if (typeof total === 'number') {
    figures.push({
      metric: `Total population — ${location}`,
      value: total,
      unit: 'people',
      period,
      source,
    });
  }
  for (const row of totals) {
    if (row.gender !== 'f' && row.gender !== 'm') continue;
    if (typeof row.population !== 'number') continue;
    figures.push({
      metric: `${row.gender === 'f' ? 'Female' : 'Male'} population — ${location}`,
      value: row.population,
      unit: 'people',
      period,
      source,
    });
  }
  for (const row of current) {
    if (row.gender !== 'all' || !row.age_range || row.age_range === 'all') continue;
    if (typeof row.population !== 'number') continue;
    figures.push({
      metric: `Population aged ${row.age_range} — ${location}`,
      value: row.population,
      unit: 'people',
      period,
      source,
    });
  }

  return {
    dataset: 'population',
    available: true,
    location,
    summary:
      typeof total === 'number'
        ? `${location} baseline population: ${count(total)} people (${period}), ${source}.`
        : `${location} baseline population: no national total published for ${period}, ${source}.`,
    figures: figures.slice(0, 14),
    note: 'Baseline population estimate, national level. Age bands are subsets of the total — do not add them to it.',
  };
}

interface FoodSecurityRow extends PeriodRow {
  ipc_phase?: string | null;
  ipc_type?: string | null;
  population_in_phase?: number | null;
  population_fraction_in_phase?: number | null;
}

const IPC_PHASE_LABELS: Record<string, string> = {
  '1': 'IPC Phase 1 (Minimal)',
  '2': 'IPC Phase 2 (Stressed)',
  '3': 'IPC Phase 3 (Crisis)',
  '4': 'IPC Phase 4 (Emergency)',
  '5': 'IPC Phase 5 (Catastrophe/Famine)',
  '3+': 'IPC Phase 3 or above (Crisis or worse)',
  all: 'Total population analysed',
};

export function transformFoodSecurity(
  rows: FoodSecurityRow[],
  iso3: string,
): DataResult | undefined {
  if (rows.length === 0) return undefined;

  const latest = latestPeriodStart(rows);
  const current = rows
    .filter((row) => row.reference_period_start === latest)
    .sort((a, b) => (a.ipc_phase ?? '').localeCompare(b.ipc_phase ?? ''));

  const location = current[0]?.location_name ?? iso3;
  const period = formatPeriod(current[0] ?? {});
  const source = SOURCES.food_security;

  const figures: Figure[] = current
    .filter((row) => typeof row.population_in_phase === 'number')
    .map((row) => {
      const fraction = row.population_fraction_in_phase;
      return {
        metric: `${IPC_PHASE_LABELS[row.ipc_phase ?? ''] ?? `IPC Phase ${row.ipc_phase}`} — ${location}`,
        value: row.population_in_phase as number,
        unit: 'people' as const,
        period,
        source,
        ...(typeof fraction === 'number'
          ? { shareOfPopulation: `${Math.round(fraction * 100)}% of the population analysed` }
          : {}),
      };
    });

  const crisisOrWorse = current.find((row) => row.ipc_phase === '3+');

  return {
    dataset: 'food_security',
    available: true,
    location,
    summary:
      crisisOrWorse && typeof crisisOrWorse.population_in_phase === 'number'
        ? `${location}: ${count(crisisOrWorse.population_in_phase)} people in IPC Phase 3 or above (crisis or worse), ${period}, ${source}.`
        : `${location} IPC acute food insecurity classification for ${period}, ${source}.`,
    figures,
    note: 'IPC acute food insecurity, current-period classification, national level. Phases 1-5 partition the analysed population; "Phase 3 or above" is their sum, not an additional group.',
  };
}

interface FundingRow extends PeriodRow {
  appeal_name?: string | null;
  appeal_type?: string | null;
  requirements_usd?: number | null;
  funding_usd?: number | null;
  funding_pct?: number | null;
}

export function transformFunding(
  rows: FundingRow[],
  iso3: string,
  today = new Date().toISOString().slice(0, 10),
): DataResult | undefined {
  // FTS also carries forward-year pledge rows: no appeal name, no requirements,
  // and a reference period years in the future. They are not appeals and would
  // otherwise sort to the top and be reported as the current funding picture.
  const appeals = rows
    .filter(
      (row) =>
        typeof row.requirements_usd === 'number' &&
        row.appeal_name &&
        row.appeal_name !== 'Not specified' &&
        (row.reference_period_start ?? '').slice(0, 10) <= today,
    )
    .sort((a, b) =>
      (b.reference_period_start ?? '').localeCompare(a.reference_period_start ?? ''),
    )
    .slice(0, 3);

  if (appeals.length === 0) return undefined;

  const location = appeals[0]?.location_name ?? rows[0]?.location_name ?? iso3;
  const source = SOURCES.funding;
  const figures: Figure[] = [];

  for (const row of appeals) {
    const period = formatPeriod(row);
    figures.push({
      metric: `Requirements — ${row.appeal_name}`,
      value: row.requirements_usd as number,
      unit: 'USD',
      period,
      source,
    });
    if (typeof row.funding_usd === 'number') {
      figures.push({
        metric: `Funding received — ${row.appeal_name}`,
        value: row.funding_usd,
        unit: 'USD',
        period,
        source,
      });
    }
    if (typeof row.funding_pct === 'number') {
      figures.push({
        metric: `Coverage — ${row.appeal_name}`,
        value: row.funding_pct,
        unit: 'percent',
        period,
        source,
      });
    }
  }

  const newest = appeals[0];
  return {
    dataset: 'funding',
    available: true,
    location,
    summary: `${newest.appeal_name}: ${usd(newest.requirements_usd as number)} required, ${
      typeof newest.funding_usd === 'number' ? usd(newest.funding_usd) : 'an unreported amount'
    } received${typeof newest.funding_pct === 'number' ? ` (${newest.funding_pct}% covered)` : ''}, ${formatPeriod(newest)}, ${source}.`,
    figures,
    note: 'Appeal requirements and funding received. Figures are cumulative for the appeal period and move during the year, so a part-year appeal will look underfunded.',
  };
}

interface NeedsRow extends PeriodRow {
  sector_name?: string | null;
  sector_code?: string | null;
  category?: string | null;
  population_status?: string | null;
  population?: number | null;
}

const POPULATION_STATUS_LABELS: Record<string, string> = {
  INN: 'People in need',
  TGT: 'People targeted',
  AFF: 'People affected',
  REA: 'People reached',
  all: 'Population',
};

export function transformNeeds(
  rows: NeedsRow[],
  iso3: string,
): DataResult | undefined {
  if (rows.length === 0) return undefined;

  // HAPI publishes each sector total alongside disaggregated cuts of the same
  // people — `category` holds "Children", "Female", "Disability" and so on. The
  // sector total is the row with no category, and it is the only row that may
  // be reported as the sector figure; keying without `category` let whichever
  // cut HAPI happened to return first stand in for the total.
  const totals = rows.filter((row) => !row.category);

  // Sectors are not all refreshed in the same planning cycle, so filtering to
  // one global latest period collapses the answer to whichever sector reported
  // most recently. Keep each sector's own latest figure instead, and carry the
  // period on every row so nothing is compared across cycles by accident.
  const latestPerSector = new Map<string, NeedsRow>();
  for (const row of totals) {
    const key = `${row.sector_name ?? row.sector_code}::${row.population_status}`;
    const existing = latestPerSector.get(key);
    if (
      !existing ||
      (row.reference_period_start ?? '') > (existing.reference_period_start ?? '')
    ) {
      latestPerSector.set(key, row);
    }
  }

  const selected = [...latestPerSector.values()]
    .filter((row) => typeof row.population === 'number')
    // Capped to keep the tool result inside a small local context window.
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, 12);

  if (selected.length === 0) return undefined;

  const location = rows[0]?.location_name ?? iso3;
  const source = SOURCES.humanitarian_needs;

  const figures: Figure[] = selected.map((row) => ({
    metric: `${
      POPULATION_STATUS_LABELS[row.population_status ?? ''] ?? row.population_status
    } — ${row.sector_name ?? row.sector_code}`,
    value: row.population as number,
    unit: 'people',
    period: formatPeriod(row),
    source,
  }));

  const intersectoralInNeed = selected.find(
    (row) => row.sector_name === 'Intersectoral' && row.population_status === 'INN',
  );

  return {
    dataset: 'humanitarian_needs',
    available: true,
    location,
    summary: intersectoralInNeed
      ? `${location}: ${count(intersectoralInNeed.population as number)} people in need overall (intersectoral), ${formatPeriod(intersectoralInNeed)}, ${source}.`
      : `${location} people in need and targeted by sector, ${source}. No intersectoral total published — do not add the sectors together to make one.`,
    figures,
    note: '"Intersectoral" is the overall figure, not a sector — never add it to the others, and never sum sectors to produce a total. Each figure carries its own reference period; sectors refresh in different planning cycles.',
  };
}

/* ------------------------------------------------------------------ *
 * Fetch + transform
 * ------------------------------------------------------------------ */

async function getPopulation(iso3: string) {
  const rows = await hapiGet<PopulationRow>(ENDPOINTS.population, {
    location_code: iso3,
    admin_level: 0,
    limit: 200,
  });
  return transformPopulation(rows, iso3);
}

async function getFoodSecurity(iso3: string) {
  const rows = await hapiGet<FoodSecurityRow>(ENDPOINTS.food_security, {
    location_code: iso3,
    admin_level: 0,
    ipc_type: 'current',
    start_date: isoYearsAgo(2),
    limit: 100,
  });
  return transformFoodSecurity(rows, iso3);
}

async function getFunding(iso3: string) {
  const rows = await hapiGet<FundingRow>(ENDPOINTS.funding, {
    location_code: iso3,
    start_date: isoYearsAgo(2),
    limit: 50,
  });
  return transformFunding(rows, iso3);
}

async function getHumanitarianNeeds(iso3: string) {
  const rows = await hapiGet<NeedsRow>(ENDPOINTS.humanitarian_needs, {
    location_code: iso3,
    admin_level: 0,
    start_date: isoYearsAgo(2),
    limit: 300,
  });
  return transformNeeds(rows, iso3);
}

const HANDLERS: Record<Dataset, (iso3: string) => Promise<DataResult | undefined>> = {
  population: getPopulation,
  food_security: getFoodSecurity,
  funding: getFunding,
  humanitarian_needs: getHumanitarianNeeds,
};

export async function fetchHumanitarianData(
  dataset: Dataset,
  countryIso3: string | null | undefined,
): Promise<HumanitarianDataResult> {
  // The model's first instinct on a global question is a null country. That
  // used to fail schema validation and surface as an opaque runtime error; it
  // now reaches here and gets an answer it can act on.
  const iso3 = countryIso3?.trim().toUpperCase();
  if (!iso3) {
    return unavailable(
      dataset,
      'no_country_given',
      'HDX HAPI is organised by country and publishes no regional or global aggregate, so this tool cannot answer a worldwide question. Ask the user which country they mean, or answer from a named published source (for example OCHA\'s Global Humanitarian Overview for global needs and funding totals) while stating that it is the source and that this tool could not verify it.',
    );
  }
  if (!/^[A-Z]{3}$/.test(iso3)) {
    return unavailable(
      dataset,
      'unknown_location',
      `"${iso3}" is not an ISO 3166-1 alpha-3 country code. ${NO_SUBSTITUTE}`,
    );
  }

  try {
    const result = await HANDLERS[dataset](iso3);
    return result ?? (await explainEmpty(dataset, iso3));
  } catch (error) {
    const cause = error instanceof Error ? error.message : 'unknown error';
    return unavailable(
      dataset,
      'upstream_error',
      `Could not reach HDX HAPI: ${cause}. Try crisis_updates for narrative situation reports instead. ${NO_SUBSTITUTE}`,
      `HDX HAPI (${dataset}) could not be reached: ${cause}`,
    );
  }
}

export const humanitarianDataTool = tool({
  description:
    'Country-level humanitarian figures from HDX HAPI (OCHA Centre for Humanitarian Data): baseline population, IPC acute food insecurity phases, appeal requirements and funding received, and people in need or targeted by sector. Mandatory before stating any caseload, displacement, food-security, needs or funding number for a country, and before agreeing with such a number the user has supplied — including numbers you are confident about, because your training data is stale by definition. Returns labelled figures with a value, unit, reference period and source; quote those, and report the reference period with every figure. Country-scoped only: HAPI holds no global or regional aggregate, and a result marked `available: false` means the figure is unverified, never that a remembered one may be used instead.',
  inputSchema: z.object({
    country_iso3: z
      .string()
      .nullish()
      .describe(
        'ISO 3166-1 alpha-3 country code, uppercase — e.g. SDN for Sudan, COD for the Democratic Republic of the Congo, AFG for Afghanistan. There is no code for a worldwide or regional total; omit it only to confirm that, since the tool cannot return one.',
      ),
    dataset: z
      .enum(['population', 'food_security', 'funding', 'humanitarian_needs'])
      .describe(
        'Which indicator to retrieve. Call the tool more than once to combine datasets.',
      ),
  }),
  execute: async ({ country_iso3, dataset }) =>
    fetchHumanitarianData(dataset as Dataset, country_iso3),
});
