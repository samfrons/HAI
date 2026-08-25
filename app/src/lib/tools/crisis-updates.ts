import { tool } from 'ai';
import { z } from 'zod';

// cost: free public APIs — ReliefWeb (UN OCHA) and IFRC GO. No key, no per-call charge.

/**
 * Live crisis information comes from one of two sources, in this order:
 *
 * 1. ReliefWeb's JSON API — the broadest humanitarian reporting index, and the
 *    preferred source. Since 1 November 2025 it rejects any `appname` OCHA has
 *    not pre-approved; approval is a reviewed request form, not a self-service
 *    key. Set RELIEFWEB_APPNAME once granted and this path activates on its own.
 * 2. IFRC GO — open, no registration, and used by default. Its lens is
 *    narrower: Red Cross / Red Crescent emergency operations rather than the
 *    whole humanitarian information space, so the most recent entry for a given
 *    country can lag ReliefWeb. The tool labels which source answered so the
 *    model can say so.
 *
 * ReliefWeb's public website is deliberately not scraped as a fallback: it
 * serves `406 {"error":"Blocked due to bot activity."}` to automated clients,
 * and working around that would be both fragile and contrary to the access
 * policy the appname requirement expresses.
 */

const RELIEFWEB_API = 'https://api.reliefweb.int/v2/reports';
const IFRC_GO_API = 'https://goadmin.ifrc.org/api/v2/event/';
const RESULT_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'HAI/1.0 (humanitarian operations assistant)';

export interface CrisisUpdate {
  title: string;
  date: string;
  source: string;
  url: string;
  excerpt: string;
  /** Present on IFRC GO results only. */
  severity?: string;
  countries?: string[];
}

export interface CrisisUpdatesResult {
  query: string;
  retrievedVia: 'reliefweb' | 'ifrc-go';
  updates: CrisisUpdate[];
  notice?: string;
}

/**
 * 60s in-memory cache. Per-instance and lost on restart, which is fine for
 * feeds that update on the order of hours — it exists to stop a single
 * multi-step tool loop from refetching the same query.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; value: CrisisUpdatesResult }>();

function readCache(key: string): CrisisUpdatesResult | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ordm: 'º',
  oacute: 'ó',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function toPlainText(html: string, maxLength: number): string {
  const text = decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...init?.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

interface ReliefWebFields {
  title?: string;
  url?: string;
  date?: { created?: string };
  source?: Array<{ name?: string }>;
  'body-html'?: string;
}

async function fetchFromReliefWeb(
  appname: string,
  query: string,
  country?: string,
): Promise<CrisisUpdate[]> {
  const response = await fetchWithTimeout(
    `${RELIEFWEB_API}?appname=${encodeURIComponent(appname)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: { value: query, operator: 'AND' },
        ...(country
          ? { filter: { field: 'country', value: country } }
          : {}),
        fields: {
          include: ['title', 'date.created', 'source.name', 'url', 'body-html'],
        },
        sort: ['date.created:desc'],
        limit: RESULT_LIMIT,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ReliefWeb API returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ fields?: ReliefWebFields }>;
  };

  return (payload.data ?? []).map((entry) => {
    const fields = entry.fields ?? {};
    return {
      title: fields.title ?? 'Untitled report',
      date: fields.date?.created?.slice(0, 10) ?? 'unknown',
      source:
        fields.source
          ?.map((s) => s.name)
          .filter(Boolean)
          .join(', ') || 'ReliefWeb',
      url: fields.url ?? 'https://reliefweb.int',
      excerpt: toPlainText(fields['body-html'] ?? '', 700) || 'No excerpt available.',
    };
  });
}

interface GoEvent {
  id?: number;
  name?: string;
  summary?: string;
  disaster_start_date?: string;
  ifrc_severity_level_display?: string;
  num_affected?: number | null;
  dtype?: { name?: string } | null;
  countries?: Array<{ name?: string }>;
}

async function fetchFromIfrcGo(query: string, country?: string): Promise<CrisisUpdate[]> {
  const search = [country, query].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    search,
    limit: String(RESULT_LIMIT),
    ordering: '-disaster_start_date',
  });

  const response = await fetchWithTimeout(`${IFRC_GO_API}?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`IFRC GO returned ${response.status}`);
  }

  const payload = (await response.json()) as { results?: GoEvent[] };

  return (payload.results ?? []).map((event) => {
    const affected =
      typeof event.num_affected === 'number'
        ? ` Reported people affected: ${event.num_affected.toLocaleString('en-US')}.`
        : '';
    return {
      title: event.name?.trim() || 'Unnamed emergency',
      date: event.disaster_start_date?.slice(0, 10) ?? 'unknown',
      source: `IFRC GO — ${event.dtype?.name ?? 'emergency'}`,
      url: `https://go.ifrc.org/emergencies/${event.id ?? ''}`,
      excerpt: `${toPlainText(event.summary ?? '', 600)}${affected}`.trim() ||
        'No summary available.',
      severity: event.ifrc_severity_level_display,
      countries: event.countries?.map((c) => c.name ?? '').filter(Boolean),
    };
  });
}

export async function getCrisisUpdates(
  query: string,
  country?: string,
): Promise<CrisisUpdatesResult> {
  const cacheKey = `${country ?? ''}::${query}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const appname = process.env.RELIEFWEB_APPNAME;
  let result: CrisisUpdatesResult | undefined;

  if (appname) {
    try {
      result = {
        query,
        retrievedVia: 'reliefweb',
        updates: await fetchFromReliefWeb(appname, query, country),
      };
    } catch {
      // An unapproved or revoked appname 403s. Fall through to IFRC GO rather
      // than failing the user's question.
      result = undefined;
    }
  }

  if (!result) {
    result = {
      query,
      retrievedVia: 'ifrc-go',
      updates: await fetchFromIfrcGo(query, country),
      notice: appname
        ? 'ReliefWeb rejected the configured appname, so these results are IFRC GO emergency operations. Tell the user the source and that its coverage is narrower than ReliefWeb.'
        : 'Results are IFRC GO emergency operations, not ReliefWeb: ReliefWeb now requires an OCHA-approved appname, which this deployment does not have. Attribute the figures to IFRC GO, note that its coverage is limited to Red Cross / Red Crescent operations, and point the user to reliefweb.int for the full reporting picture.',
    };
  }

  if (result.updates.length === 0) {
    result.notice = `No matching emergencies were found${
      country ? ` for ${country}` : ''
    }. Say so rather than substituting remembered figures; suggest a broader search term or the country name on its own.`;
  }

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}

export const crisisUpdatesTool = tool({
  description:
    'Fetch recent situation reports and emergency records for a crisis, country, or theme from live humanitarian sources (ReliefWeb where configured, otherwise IFRC GO). Use this for anything about the current state of an emergency — displacement, access, response activity, recent developments — rather than answering from memory. Returns titles, dates, publishing organisations, links, and excerpts, plus which source answered. Always tell the user which source the information came from and the date of the report.',
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'What to search for — a crisis, theme, or sector, e.g. "displacement", "cholera outbreak", "flooding".',
      ),
    country: z
      .string()
      .optional()
      .describe(
        'Country name to focus the search on, e.g. "Sudan", "Democratic Republic of the Congo". Omit for a global search.',
      ),
  }),
  execute: async ({ query, country }) => {
    try {
      return await getCrisisUpdates(query, country);
    } catch (error) {
      return {
        query,
        updates: [],
        error: `Could not reach the live crisis feeds: ${
          error instanceof Error ? error.message : 'unknown error'
        }. Tell the user that live situation reports are unavailable right now rather than substituting remembered figures. Structured country indicators may still be available via the humanitarian_data tool.`,
      };
    }
  },
});
