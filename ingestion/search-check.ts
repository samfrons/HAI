/**
 * Smoke-test the deployed hybrid search: embeds a query with Voyage and calls
 * the search_standards_hybrid RPC exactly the way the app should.
 *
 *   pnpm search "minimum water supply per person per day"
 *   pnpm search "informed consent" --source=iasc_data_responsibility --count=5
 */
import { embedQuery, ollamaReachable } from './embed.ts';
import { searchStandardsHybrid, serviceClient, supabaseConfigured } from './load.ts';
import type { SourceKey } from './config.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const query = args.find((a) => !a.startsWith('--')) ?? 'minimum water supply per person per day';
  const source = (args.find((a) => a.startsWith('--source='))?.split('=')[1] ?? null) as SourceKey | null;
  const count = Number(args.find((a) => a.startsWith('--count='))?.split('=')[1] ?? 8);

  if (!supabaseConfigured()) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  // Without Ollama the RPC still runs, using the full-text leg alone.
  const embedding = (await ollamaReachable()) ? await embedQuery(query) : null;
  if (!embedding) console.log('(no Ollama server reachable: full-text leg only)\n');

  const rows = await searchStandardsHybrid(serviceClient(), {
    query_text: query,
    query_embedding: embedding,
    match_count: count,
    filter_source: source,
  });

  console.log(`query: ${query}${source ? ` [source=${source}]` : ''}\n`);
  for (const [i, row] of rows.entries()) {
    console.log(
      `${i + 1}. [${row.source}] p${row.page_start}-${row.page_end} score=${row.score.toFixed(5)} ` +
        `(semantic ${row.semantic_rank ?? '-'}, fts ${row.fulltext_rank ?? '-'})`,
    );
    if (row.section_path) console.log(`   ${row.section_path}`);
    if (row.context_summary) console.log(`   context: ${row.context_summary}`);
    console.log(`   ${row.content.replace(/\s+/g, ' ').slice(0, 240)}...\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
