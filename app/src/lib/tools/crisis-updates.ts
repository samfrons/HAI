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
 *    Until then the source is treated as disabled rather than broken: it is not
 *    called at all, and it says once per result that it is not configured.
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
/*
 * Deliberately small. Every result is re-sent to the model on each step of the
 * tool loop, and Ollama's default context is 4096 tokens — five long excerpts
 * push the system prompt out of the window, at which point the model loses its
 * grounding and language rules mid-answer. See README on OLLAMA_CONTEXT_LENGTH.
 */
const RESULT_LIMIT = 4;
const EXCERPT_CHARS = 350;
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

/** One upstream source that was unavailable, in the shape `harvest()` reads. */
export interface SourceIssue {
  source: string;
  message: string;
}

export interface CrisisUpdatesResult {
  query: string;
  retrievedVia: 'reliefweb' | 'ifrc-go';
  updates: CrisisUpdate[];
  /**
   * How the model should attribute a successful retrieval — which source
   * answered and what its coverage excludes.
   *
   * Deliberately NOT `notice`. Across this codebase `notice` means "this
   * retrieval came back empty" and is read as a failure by both trace paths:
   * `chat-trace.ts` turns it into an `ok: false` step and `evidence.ts`
   * `extractFailures` turns it into a `source-error`. Carrying routine sourcing
   * guidance in that field marked every successful IFRC GO answer as a failed
   * source, once per call and once per deliverable section.
   */
  sourceNote?: string;
  /** Reserved for a genuinely empty retrieval. */
  notice?: string;
  /**
   * Sources that did not answer, reported per source rather than as a whole-tool
   * failure. `harvest()` renders these into the deliverable's "Source issues"
   * block (de-duplicated there) and the trace panel shows them as notices.
   */
  errors?: SourceIssue[];
}

/**
 * ReliefWeb without an approved appname is an expected deployment state, not a
 * fault: the API is never called, and the absence is announced once through the
 * same per-source channel any other unavailable source uses.
 */
const RELIEFWEB_NOT_CONFIGURED: SourceIssue = {
  source: 'ReliefWeb',
  message:
    'Not enabled on this deployment, so it was not queried: ReliefWeb requires an appname approved by OCHA and none is configured. Crisis updates below come from IFRC GO, which covers Red Cross / Red Crescent operations only — consult reliefweb.int directly for the fuller reporting picture.',
};

type ReliefWebConfig =
  | { configured: true; appname: string }
  | { configured: false; issue: SourceIssue };

function reliefWebConfig(): ReliefWebConfig {
  const appname = process.env.RELIEFWEB_APPNAME?.trim();
  return appname
    ? { configured: true, appname }
    : { configured: false, issue: RELIEFWEB_NOT_CONFIGURED };
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
      excerpt: toPlainText(fields['body-html'] ?? '', EXCERPT_CHARS) || 'No excerpt available.',
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
      excerpt: `${toPlainText(event.summary ?? '', EXCERPT_CHARS)}${affected}`.trim() ||
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

  // Configuration is settled before any request goes out, so the unconfigured
  // path costs no call and raises nothing.
  const config = reliefWebConfig();
  const issues: SourceIssue[] = [];
  let result: CrisisUpdatesResult | undefined;

  if (config.configured) {
    try {
      result = {
        query,
        retrievedVia: 'reliefweb',
        updates: await fetchFromReliefWeb(config.appname, query, country),
      };
    } catch (error) {
      // An unapproved or revoked appname 403s. That is a real degradation, so
      // it is recorded against ReliefWeb — but it still falls through to IFRC
      // GO rather than failing the user's question.
      issues.push({
        source: 'ReliefWeb',
        message: `Configured but did not answer (${
          error instanceof Error ? error.message : 'unknown error'
        }). Results below are from IFRC GO instead; the appname may no longer be approved.`,
      });
    }
  } else {
    issues.push(config.issue);
  }

  if (!result) {
    result = {
      query,
      retrievedVia: 'ifrc-go',
      updates: await fetchFromIfrcGo(query, country),
      sourceNote:
        'These results are IFRC GO emergency operations, not ReliefWeb. Attribute the figures to IFRC GO, say that its coverage is limited to Red Cross / Red Crescent operations, and point the user to reliefweb.int for the full reporting picture.',
    };
  }

  if (issues.length > 0) {
    result.errors = issues;
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
    'Fetch recent situation reports and emergency records for a crisis, country, or theme from live humanitarian sources (ReliefWeb where configured, otherwise IFRC GO). Mandatory before describing the current state of any emergency — displacement, access, response activity, recent developments — rather than answering from memory. Returns titles, dates, publishing organisations, links, and excerpts, plus which source answered. Always name the source and the report date. These are narrative reports, not a statistical series: use humanitarian_data for a country caseload or funding figure, and do not present a number quoted inside a situation report as a current official total.',
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
