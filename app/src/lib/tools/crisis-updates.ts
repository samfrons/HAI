import { tool } from 'ai';
import { z } from 'zod';

// cost: free public API — ReliefWeb (UN OCHA). No key, no per-call charge.

/**
 * ReliefWeb has two access paths, and this tool uses whichever is available:
 *
 * 1. The JSON API (api.reliefweb.int/v2). Richer and preferred, but since
 *    1 November 2025 it rejects any `appname` that OCHA has not pre-approved
 *    — approval is a reviewed request form, not a self-service key. Set
 *    RELIEFWEB_APPNAME once you have one and this path activates on its own.
 * 2. The public RSS feed on reliefweb.int. No registration, same editorial
 *    content, fewer fields. This is what runs today.
 */

const RELIEFWEB_API = 'https://api.reliefweb.int/v2/reports';
const RELIEFWEB_RSS = 'https://reliefweb.int/updates/rss.xml';
const RESULT_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 15_000;

export interface CrisisUpdate {
  title: string;
  date: string;
  source: string;
  url: string;
  excerpt: string;
}

export interface CrisisUpdatesResult {
  query: string;
  retrievedVia: 'reliefweb-api' | 'reliefweb-rss';
  updates: CrisisUpdate[];
  notice?: string;
}

/**
 * 60s in-memory cache. Per-instance and lost on restart, which is fine for a
 * feed that updates on the order of hours — it exists to stop a single
 * multi-step tool loop from hitting ReliefWeb repeatedly for the same query.
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

function writeCache(key: string, value: CrisisUpdatesResult) {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
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
  const text = decodeEntities(decodeEntities(html))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

function tagContent(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match) return undefined;
  const raw = match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1');
  return decodeEntities(raw).trim();
}

/**
 * The RSS `description` packs the ReliefWeb tags and the report body into one
 * escaped HTML blob. The publishing organisation is the `source` tag, which is
 * what a practitioner needs to judge the report.
 */
function parseRssItem(item: string): CrisisUpdate | undefined {
  const title = tagContent(item, 'title');
  const url = tagContent(item, 'link');
  if (!title || !url) return undefined;

  const description = tagContent(item, 'description') ?? '';
  const sourceTag = /<div class="tag source">Sources?:\s*([\s\S]*?)<\/div>/.exec(
    decodeEntities(description),
  );

  const body = decodeEntities(description).replace(
    /<div class="tag [^"]*">[\s\S]*?<\/div>/g,
    '',
  );

  return {
    title,
    date: tagContent(item, 'pubDate') ?? 'unknown',
    source: sourceTag ? toPlainText(sourceTag[1], 200) : 'ReliefWeb',
    url,
    excerpt: toPlainText(body, 700) || 'No excerpt available.',
  };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function fetchViaRss(query: string, country?: string): Promise<CrisisUpdate[]> {
  const search = country ? `${country} ${query}`.trim() : query;
  const url = `${RELIEFWEB_RSS}?search=${encodeURIComponent(search)}`;

  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/rss+xml, application/xml' },
  });
  if (!response.ok) {
    throw new Error(`ReliefWeb RSS returned ${response.status}`);
  }

  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items
    .slice(0, RESULT_LIMIT)
    .map(parseRssItem)
    .filter((update): update is CrisisUpdate => update !== undefined);
}

interface ReliefWebApiFields {
  title?: string;
  url?: string;
  date?: { created?: string };
  source?: Array<{ name?: string }>;
  'body-html'?: string;
}

async function fetchViaApi(
  appname: string,
  query: string,
  country?: string,
): Promise<CrisisUpdate[]> {
  const filters = [];
  if (country) {
    filters.push({ field: 'country', value: country });
  }

  const response = await fetchWithTimeout(
    `${RELIEFWEB_API}?appname=${encodeURIComponent(appname)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: { value: query, operator: 'AND' },
        ...(filters.length ? { filter: { operator: 'AND', conditions: filters } } : {}),
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
    data?: Array<{ fields?: ReliefWebApiFields }>;
  };

  return (payload.data ?? []).map((entry) => {
    const fields = entry.fields ?? {};
    return {
      title: fields.title ?? 'Untitled report',
      date: fields.date?.created ?? 'unknown',
      source:
        fields.source?.map((s) => s.name).filter(Boolean).join(', ') || 'ReliefWeb',
      url: fields.url ?? 'https://reliefweb.int',
      excerpt: toPlainText(fields['body-html'] ?? '', 700) || 'No excerpt available.',
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
  let result: CrisisUpdatesResult;

  if (appname) {
    try {
      result = {
        query,
        retrievedVia: 'reliefweb-api',
        updates: await fetchViaApi(appname, query, country),
      };
    } catch {
      // An unapproved or revoked appname 403s. Fall through to the open feed
      // rather than failing the user's question.
      result = {
        query,
        retrievedVia: 'reliefweb-rss',
        updates: await fetchViaRss(query, country),
        notice:
          'The ReliefWeb JSON API rejected the configured appname; these results come from the public ReliefWeb feed instead.',
      };
    }
  } else {
    result = {
      query,
      retrievedVia: 'reliefweb-rss',
      updates: await fetchViaRss(query, country),
    };
  }

  if (result.updates.length === 0) {
    result.notice =
      'ReliefWeb returned no reports for this query. Try a broader search term or the country name on its own.';
  }

  writeCache(cacheKey, result);
  return result;
}

export const crisisUpdatesTool = tool({
  description:
    'Fetch recent situation reports, updates, and analysis published on ReliefWeb (UN OCHA) for a crisis, country, or theme. Use this for anything about the current state of an emergency — displacement, access, response activity, recent developments — rather than answering from memory. Returns titles, publication dates, publishing organisations, links, and excerpts.',
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'What to search ReliefWeb for — a crisis, theme, or sector, e.g. "displacement", "cholera outbreak response", "humanitarian access".',
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
        error: `Could not reach ReliefWeb: ${
          error instanceof Error ? error.message : 'unknown error'
        }. Tell the user that live situation reports are unavailable right now rather than substituting remembered figures.`,
      };
    }
  },
});
