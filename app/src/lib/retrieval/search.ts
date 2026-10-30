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

import { embedQuery } from './embeddings';

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
   * Set whenever the result set is empty, for any reason the model needs to
   * tell the user about: corpus not ingested, retrieval backend down, or a
   * search that ran fine and matched nothing. Absent only when chunks came
   * back — an empty `chunks` with no notice would read to the model as
   * permission to answer from memory.
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

/**
 * Same instruction again, for the case the other two do not cover: retrieval
 * worked and the corpus simply does not contain the answer. Most eval questions
 * that went unsourced were of this kind — platform, dataset and organisational
 * facts (what HDX hosts, what PRIMES manages) that the handbooks never carried.
 * Without a notice they returned a bare empty array, which reads to the model
 * exactly like permission to answer from memory.
 */
const NO_MATCH_NOTICE =
  'NO MATCH: the search ran and the corpus returned no relevant passage, so this question is not covered by the Sphere Handbook, the CHS, or IASC guidance. You MUST NOT cite any of them for it, and you MUST NOT invent a section or figure. Say plainly which part of the question the corpus does not cover. If the question is about a humanitarian platform, dataset, organisation, or a global statistic, note that this corpus holds standards rather than organisational facts, name the authoritative publisher instead (for example OCHA for HDX and funding, UNHCR for refugee registration figures), and give any general knowledge explicitly labelled as unsourced and unverified.';

/** Same instruction, worded for a backend that is down rather than unconfigured. */
const RETRIEVAL_UNAVAILABLE_NOTICE =
  'RETRIEVAL FAILED: the standards search backend is unavailable right now, so nothing was searched and no passage was found. You MUST NOT state any standard, indicator, threshold, or figure as if it came from the Sphere Handbook, the CHS, or IASC guidance, and you MUST NOT cite a section, chapter, or page number — any you recall may be from a superseded edition or invented. Tell the user plainly that the standards search is temporarily unavailable and that you cannot give a sourced answer right now. You may offer general humanitarian practice only if you label it explicitly as unsourced and recommend they verify it against the published handbook.';

// --- Query embedding ---------------------------------------------------
//
// Delegated to ./embeddings, which serves the same mxbai-embed-large vectors
// from local Ollama or hosted Hugging Face depending on EMBEDDINGS_PROVIDER.
// It returns null rather than throwing on any failure, and a null embedding
// still reaches `search_standards_hybrid`, which then falls back to the
// full-text leg alone instead of failing the whole search.

/** One retry, short backoff — enough to survive a transient contention spike
 * without turning a slow moment into a user-visible "retrieval unavailable". */
const RETRY_DELAY_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Fire-and-forget ping against the same Supabase project the real search
 * hits, meant to be started at the very top of a request — before the model
 * has decided whether it needs to search at all — so the TCP/TLS handshake
 * and PostgREST connection warm-up happen off the critical path. A plain
 * `select` rather than the RPC itself: it needs no embedding and no
 * match-count work, just a live connection by the time the real RPC call
 * lands a step or two later. Never throws; its result is discarded.
 */
export function warmSupabaseConnection(): void {
  const client = getClient();
  if (!client) return;

  client
    .from('standards_chunks')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
    .then(
      () => {},
      () => {},
    );
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

    if (rows.length === 0) {
      return { chunks: [], notice: NO_MATCH_NOTICE };
    }

    return { chunks: rows.map(toChunk) };
  } catch {
    return { chunks: [], notice: RETRIEVAL_UNAVAILABLE_NOTICE };
  }
}
