/**
 * Retrieval interface over the humanitarian standards corpus.
 *
 * The implementation of `searchStandards` is currently a stub. The contract
 * below (argument shape, return shape, the `notice` escape hatch) is the part
 * that other modules depend on — the ingestion work replaces the function
 * body only, and nothing else in the app needs to change.
 */

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

/**
 * Search the standards corpus for passages relevant to `query`.
 *
 * STUB: returns an empty result set with a notice. Replace the body with the
 * real retrieval (embed the query, search the vector store, return ranked
 * chunks) — the signature and types above stay as they are.
 */
export async function searchStandards(
  options: SearchStandardsOptions,
): Promise<SearchStandardsResult> {
  void options;

  return {
    chunks: [],
    notice: NOT_INGESTED_NOTICE,
  };
}
