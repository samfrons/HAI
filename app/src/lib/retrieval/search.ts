/**
 * Retrieval interface over the humanitarian standards corpus.
 *
 * Backed by `public.search_standards_hybrid` in the local Supabase/pgvector
 * stack — see ingestion/README.md § "RPC contract for the app" for the full
 * contract this implementation follows. The DB stores five source keys
 * (`sphere`, `chs`, `iasc_data_responsibility`, `iasc_protection`,
 * `iasc_disability`); this module's `StandardsSource` union collapses the
 * three IASC documents to one and maps back with `startsWith('iasc')`.
 *
 * The contract below (argument shape, return shape, the `notice` escape
 * hatch) is the part other modules depend on and stays exactly as it was.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type StandardsSource = 'sphere' | 'chs' | 'iasc';

/** `'all'` is accepted at the call site and means "no source filter". */
export type StandardsSourceFilter = StandardsSource | 'all';

export interface StandardsChunk {
  /** Stable identifier for the chunk, unique within the corpus. */
  id: string;
  source: StandardsSource;
  /**
   * Human-readable location within the source document, specific enough to
   * verify against the printed handbook — e.g.
   * "WASH Standard 2.1: Water supply" or "CHS Commitment 5".
   */
  section: string;
  /** The passage text to be quoted and cited. */
  text: string;
  /** Relevance score, higher is better. Comparable only within one result set. */
  score: number;
  /** Optional deep link to the passage on the publisher's site. */
  url?: string;
}

export interface SearchStandardsOptions {
  query: string;
  source?: StandardsSourceFilter;
  /** Maximum chunks to return. Implementations may return fewer. */
  limit?: number;
}

export interface SearchStandardsResult {
  chunks: StandardsChunk[];
  /**
   * Set when the result set is empty or degraded for a reason the model needs
   * to tell the user about (corpus not ingested, retrieval backend down).
   * Absent on a normal successful search, including one that legitimately
   * found no match.
   */
  notice?: string;
}

/*
 * Worded as an instruction, not a status line. Smaller local models will
 * otherwise treat an empty result as permission to answer from memory and
 * invent a figure with a section number attached — which is the single worst
 * failure this app can produce.
 */
const NOT_INGESTED_NOTICE =
  'RETRIEVAL FAILED: the standards corpus has not been ingested yet, so nothing was searched and no passage was found. You MUST NOT state any standard, indicator, threshold, or figure as if it came from the Sphere Handbook, the CHS, or IASC guidance, and you MUST NOT cite a section, chapter, or page number — any you recall may be from a superseded edition or invented. Tell the user plainly that the standards corpus is unavailable and that you cannot give a sourced answer. You may offer general humanitarian practice only if you label it explicitly as unsourced and recommend they verify it against the published handbook.';

/** Same instruction, worded for a backend that is down rather than unconfigured. */
const RETRIEVAL_UNAVAILABLE_NOTICE =
  'RETRIEVAL FAILED: the standards search backend is unavailable right now, so nothing was searched and no passage was found. You MUST NOT state any standard, indicator, threshold, or figure as if it came from the Sphere Handbook, the CHS, or IASC guidance, and you MUST NOT cite a section, chapter, or page number — any you recall may be from a superseded edition or invented. Tell the user plainly that the standards search is temporarily unavailable and that you cannot give a sourced answer right now. You may offer general humanitarian practice only if you label it explicitly as unsourced and recommend they verify it against the published handbook.';

// --- Query embedding ---------------------------------------------------
//
// mxbai-embed-large is trained with an asymmetric retrieval prompt: queries
// carry this prefix, documents do not (see ingestion/embed.ts, which the
// corpus was embedded with). Omitting it measurably degrades recall.

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'mxbai-embed-large';
const EMBED_DIMENSIONS = 1024;
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
/*
 * Raised from 15s: a concurrent eval run driving two other local models
 * (qwen2.5 + deepseek-r1) starved this endpoint enough to blow the old
 * timeout on an otherwise-healthy Ollama server. Still well under the
 * chat route's own stall timeout.
 */
const EMBED_TIMEOUT_MS = 20_000;
/** One retry, short backoff — enough to survive a transient contention spike
 * without turning a slow moment into a user-visible "retrieval unavailable". */
const RETRY_DELAY_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

async function fetchEmbedding(text: string): Promise<number[] | null> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [`${QUERY_PREFIX}${text}`],
    }),
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const json = (await response.json()) as OllamaEmbedResponse;
  const vector = json.embeddings?.[0];
  if (!vector || vector.length !== EMBED_DIMENSIONS) return null;
  return vector;
}

/**
 * Returns `null` on any failure (unreachable server, wrong dimensions, or a
 * second consecutive miss after the retry) rather than throwing — a query
 * still reaches `search_standards_hybrid` with `query_embedding: null`,
 * which falls back to the full-text leg alone instead of failing the whole
 * search.
 */
async function embedQuery(text: string): Promise<number[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const vector = await fetchEmbedding(text);
      if (vector) return vector;
    } catch {
      // fall through to retry/give-up below
    }
    if (attempt === 0) await delay(RETRY_DELAY_MS);
  }
  return null;
}

// --- Supabase client -----------------------------------------------------
//
// RLS on standards_chunks grants SELECT only to anon/authenticated and the
// RPC is security invoker, so the anon key is safe for server-side search —
// no service role key needed here (ingestion uses that, to bypass RLS for
// writes).

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

// --- Row mapping -----------------------------------------------------------

interface HybridSearchRow {
  id: string;
  source: string;
  doc_title: string;
  section_path: string;
  page_start: number | null;
  page_end: number | null;
  content: string;
  score: number;
}

function toStandardsSource(source: string): StandardsSource {
  if (source.startsWith('iasc')) return 'iasc';
  return source as StandardsSource;
}

/** e.g. "WASH > Water supply > Water supply standard 2.1 (Sphere Handbook..., p106–107)". */
function formatSection(row: HybridSearchRow): string {
  const page =
    row.page_start == null
      ? null
      : row.page_end != null && row.page_end !== row.page_start
        ? `p${row.page_start}-${row.page_end}`
        : `p${row.page_start}`;

  const location = row.section_path?.trim() || row.doc_title;
  const detail = [row.doc_title, page].filter(Boolean).join(', ');

  return location === row.doc_title ? `${location}${page ? ` (${page})` : ''}` : `${location} (${detail})`;
}

function toChunk(row: HybridSearchRow): StandardsChunk {
  return {
    id: row.id,
    source: toStandardsSource(row.source),
    section: formatSection(row),
    text: row.content,
    score: row.score,
  };
}

// --- Public API --------------------------------------------------------

/**
 * Search the standards corpus for passages relevant to `query`.
 *
 * Embeds the query (with the required asymmetric prefix), then calls
 * `search_standards_hybrid` for reciprocal-rank-fused vector + full-text
 * results. Returns an empty result set with an instruction-shaped `notice`
 * when the corpus isn't configured or the backend is unreachable — never
 * throws, so a down retrieval backend degrades to "tell the user", not a
 * broken chat turn.
 */
export async function searchStandards(
  options: SearchStandardsOptions,
): Promise<SearchStandardsResult> {
  const client = getClient();
  if (!client) {
    return { chunks: [], notice: NOT_INGESTED_NOTICE };
  }

  const filterSource =
    !options.source || options.source === 'all' ? null : options.source;

  try {
    const embedding = await embedQuery(options.query);

    // One retry here too: the RPC hits Postgres over the pooler, and a
    // statement-timeout under load is exactly as transient as a slow embed —
    // worth one short wait before telling the user retrieval is down.
    let rows: HybridSearchRow[] = [];
    let succeeded = false;
    for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
      const { data, error } = await client.rpc('search_standards_hybrid', {
        query_text: options.query,
        query_embedding: embedding ? JSON.stringify(embedding) : null,
        match_count: options.limit ?? 8,
        filter_source: filterSource,
      });

      if (!error) {
        rows = (data ?? []) as HybridSearchRow[];
        succeeded = true;
        break;
      }

      if (attempt === 0) await delay(RETRY_DELAY_MS);
    }

    if (!succeeded) {
      return { chunks: [], notice: RETRIEVAL_UNAVAILABLE_NOTICE };
    }

    return { chunks: rows.map(toChunk) };
  } catch {
    return { chunks: [], notice: RETRIEVAL_UNAVAILABLE_NOTICE };
  }
}
