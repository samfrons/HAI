import { tool } from 'ai';
import { z } from 'zod';

import { fetchAlerts, type GdacsAlert } from './live-sources/gdacs';
import { fetchPlans, type ResponsePlan } from './live-sources/hpc';
import { fetchEarthquakes, type EarthquakeEvent } from './live-sources/usgs';
import { fetchCountryContext, type WorldBankIndicatorValue } from './live-sources/worldbank';

// Aggregates the keyless live hazard/context sources (USGS, GDACS, World Bank,
// OCHA HPC) behind one tool call, so a source that is down degrades its own
// section instead of failing the whole answer.
//
// Ported from commit eb5e5c3 (src/hai/situation.py),
// which combines the same connectors into `global_overview` / `country_brief`
// reports with a `_try`-per-source degradation pattern reproduced here.

const GLOBAL_SOURCES = ['gdacs', 'usgs', 'hpc'] as const;
const COUNTRY_SOURCES = ['gdacs', 'worldbank'] as const;
type Source = (typeof GLOBAL_SOURCES)[number] | (typeof COUNTRY_SOURCES)[number];

/** Cap list lengths: results are re-sent to the model on every tool-loop step. */
const EARTHQUAKE_LIMIT = 10;
const GDACS_LIMIT = 10;
const PLAN_LIMIT = 15;

export interface HazardsContextResult {
  scope: 'global' | 'country';
  countryIso3?: string;
  generatedAt: string;
  gdacsAlerts?: GdacsAlert[];
  earthquakes?: EarthquakeEvent[];
  responsePlans?: ResponsePlan[];
  countryContext?: WorldBankIndicatorValue[];
  /** One entry per source that failed or was skipped — the report is
   * degraded, not absent, when this is non-empty. */
  errors: string[];
}

async function tryFetch<T>(
  errors: string[],
  source: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    errors.push(`${source}: ${error instanceof Error ? error.message : 'unknown error'}`);
    return undefined;
  }
}

export async function getGlobalHazardsOverview(sources: readonly Source[]): Promise<HazardsContextResult> {
  const errors: string[] = [];
  const result: HazardsContextResult = {
    scope: 'global',
    generatedAt: new Date().toISOString(),
    errors,
  };

  if (sources.includes('gdacs')) {
    const alerts = await tryFetch(errors, 'gdacs', () => fetchAlerts({ minLevel: 'orange' }));
    result.gdacsAlerts = alerts?.slice(0, GDACS_LIMIT) ?? [];
  }
  if (sources.includes('usgs')) {
    const events = await tryFetch(errors, 'usgs', () => fetchEarthquakes('significant_week'));
    result.earthquakes = events?.slice(0, EARTHQUAKE_LIMIT) ?? [];
  }
  if (sources.includes('hpc')) {
    const year = new Date().getUTCFullYear();
    const plans = await tryFetch(errors, 'hpc', () => fetchPlans(year));
    result.responsePlans = plans?.slice(0, PLAN_LIMIT) ?? [];
  }
  return result;
}

export async function getCountryHazardsBrief(
  countryIso3: string,
  sources: readonly Source[],
): Promise<HazardsContextResult> {
  const errors: string[] = [];
  const result: HazardsContextResult = {
    scope: 'country',
    countryIso3,
    generatedAt: new Date().toISOString(),
    errors,
  };

  if (sources.includes('gdacs')) {
    const alerts = await tryFetch(errors, 'gdacs', () => fetchAlerts({ minLevel: 'green', countryIso3 }));
    result.gdacsAlerts = alerts?.slice(0, GDACS_LIMIT) ?? [];
  }
  if (sources.includes('worldbank')) {
    const context = await tryFetch(errors, 'worldbank', () => fetchCountryContext(countryIso3));
    result.countryContext = context ?? [];
  }
  return result;
}

export const hazardsContextTool = tool({
  description:
    'Live hazard and country-context data: GDACS multi-hazard disaster alerts, USGS significant earthquakes, World Bank development indicators, and UN OCHA response plans. Use for the current disaster/hazard picture or country baseline indicators (population, GDP per capita, refugees, poverty) — not for crisis narrative reporting (use crisis_updates) or caseload/funding figures (use humanitarian_data). scope "country" requires country_iso3. A source that fails is reported in `errors`, not silently omitted; never substitute a remembered figure for one missing there.',
  inputSchema: z.object({
    scope: z.enum(['global', 'country']).describe('"global" for a worldwide hazard snapshot, "country" for one country.'),
    country_iso3: z
      .string()
      .optional()
      .describe('ISO 3166-1 alpha-3 code, e.g. SDN. Required when scope is "country".'),
    sources: z
      .array(z.enum(['usgs', 'gdacs', 'worldbank', 'hpc']))
      .optional()
      .describe(
        'Restrict to a subset of sources. Defaults to gdacs+usgs+hpc for "global", gdacs+worldbank for "country". Sources irrelevant to the scope are ignored.',
      ),
  }),
  execute: async (input) => runHazardsContext(input),
});

export interface HazardsContextInput {
  scope: 'global' | 'country';
  country_iso3?: string;
  sources?: Source[];
}

export async function runHazardsContext({
  scope,
  country_iso3,
  sources,
}: HazardsContextInput): Promise<HazardsContextResult> {
  if (scope === 'country') {
    const iso3 = country_iso3?.trim().toUpperCase();
    if (!iso3 || !/^[A-Z]{3}$/.test(iso3)) {
      return {
        scope: 'country',
        generatedAt: new Date().toISOString(),
        gdacsAlerts: [],
        countryContext: [],
        errors: [
          `input: "${country_iso3 ?? ''}" is not a valid ISO 3166-1 alpha-3 code; ask the user which country they mean rather than guessing one.`,
        ],
      };
    }
    const active = sources?.length ? COUNTRY_SOURCES.filter((s) => sources.includes(s)) : COUNTRY_SOURCES;
    return getCountryHazardsBrief(iso3, active);
  }

  const active = sources?.length ? GLOBAL_SOURCES.filter((s) => sources.includes(s)) : GLOBAL_SOURCES;
  return getGlobalHazardsOverview(active);
}
