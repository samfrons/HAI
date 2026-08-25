import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { chunkDoc, chunkStats, type Chunk, type ChunkStats } from './chunk.ts';
import {
  CORPUS,
  CORPUS_DIR,
  MANIFEST_PATH,
  credentialReport,
  env,
  type CorpusDoc,
  type SourceKey,
} from './config.ts';
import { contextualizeChunks, probeContextualizeSpeed } from './contextualize.ts';
import {
  embedDocuments,
  embeddingInput,
  ollamaHasModel,
  ollamaReachable,
} from './embed.ts';
import { extractDoc, type ExtractStats } from './extract.ts';
import { loadChunks, serviceClient, supabaseConfigured, type LoadableChunk } from './load.ts';

type Stage = 'extract' | 'chunk' | 'contextualize' | 'embed' | 'load';
const STAGE_ORDER: Stage[] = ['extract', 'chunk', 'contextualize', 'embed', 'load'];

/**
 * Contextualizing a 458-page handbook through a local 14B model can take hours.
 * Past this budget a document is loaded with context_summary = '' instead, which
 * costs some retrieval quality but keeps the corpus complete and searchable.
 */
const CONTEXTUALIZE_BUDGET_MS = 45 * 60 * 1000;
/** The contextualizer's own worker count; used to project wall-clock time. */
const CONTEXTUALIZE_CONCURRENCY = 3;

interface ManifestEntry {
  source: SourceKey;
  file: string;
  fileSha256: string;
  docTitle: string;
  ingestedAt: string;
  stageReached: Stage;
  extract: ExtractStats;
  chunk: ChunkStats;
  contextualized: number;
  embedded: number;
  loaded: number;
  deletedStale: number;
  embeddingModel: string;
  contextModel: string;
  notes: string[];
}

interface Manifest {
  version: 1;
  updatedAt: string;
  documents: Record<string, ManifestEntry>;
}

interface Options {
  stopAfter: Stage;
  only: SourceKey[] | null;
  force: boolean;
}

function parseArgs(argv: string[]): Options {
  let stopAfter: Stage = 'load';
  let only: SourceKey[] | null = null;
  let force = false;

  for (const arg of argv) {
    if (arg.startsWith('--stop-after=')) {
      const value = arg.split('=')[1] as Stage;
      if (!STAGE_ORDER.includes(value)) {
        throw new Error(`--stop-after must be one of ${STAGE_ORDER.join(', ')}`);
      }
      stopAfter = value;
    } else if (arg.startsWith('--source=')) {
      only = arg.split('=')[1].split(',') as SourceKey[];
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: pnpm ingest [options]',
          '',
          '  --stop-after=<stage>   extract | chunk | contextualize | embed | load (default: load)',
          '  --source=a,b           only these source keys',
          '  --force                re-run documents whose hash is unchanged',
          '',
          'Environment: OLLAMA_BASE_URL, EMBEDDING_MODEL, CONTEXT_MODEL,',
          'SKIP_CONTEXTUALIZE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return { stopAfter, only, force };
}

function reached(stage: Stage, stopAfter: Stage): boolean {
  return STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(stopAfter);
}

async function loadManifest(): Promise<Manifest> {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 1, updatedAt: new Date().toISOString(), documents: {} };
  }
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Manifest;
}

async function sha256OfFile(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function progressBar(label: string) {
  let last = 0;
  return (done: number, total: number) => {
    const pct = Math.floor((done / total) * 100);
    if (pct >= last + 10 || done === total) {
      last = pct;
      process.stdout.write(`    ${label}: ${done}/${total} (${pct}%)\n`);
    }
  };
}

function minutes(ms: number): string {
  return `${(ms / 60000).toFixed(1)} min`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log('HAI corpus ingestion (local stack: Ollama + Supabase, no paid APIs)');
  console.log(`  settings: ${JSON.stringify(credentialReport())}`);

  // Decide up front how far this run can actually get, so the report is honest
  // about what was skipped rather than failing halfway through a document.
  let stopAfter = options.stopAfter;
  const gateNotes: string[] = [];

  if (reached('embed', stopAfter)) {
    if (!(await ollamaReachable())) {
      stopAfter = 'contextualize';
      gateNotes.push(`no Ollama server at ${env.ollamaBaseUrl}: stopping after contextualize`);
    } else if (!(await ollamaHasModel(env.embeddingModel))) {
      stopAfter = 'contextualize';
      gateNotes.push(`${env.embeddingModel} not pulled: stopping after contextualize`);
    }
  }
  if (reached('load', stopAfter) && !supabaseConfigured()) {
    stopAfter = 'embed';
    gateNotes.push('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing: stopping after embed');
  }
  for (const note of gateNotes) console.log(`  ${note}`);
  console.log(`  stages: ${STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stopAfter) + 1).join(' -> ')}`);

  const manifest = await loadManifest();
  const targets = options.only ? CORPUS.filter((d) => options.only!.includes(d.source)) : CORPUS;

  const missing = targets.filter((d) => !existsSync(resolve(CORPUS_DIR, d.file)));
  if (missing.length > 0) {
    console.error(
      `\nMissing corpus files: ${missing.map((d) => d.file).join(', ')}\nRun ./fetch-corpus.sh first.`,
    );
    process.exit(1);
  }

  const pending: { doc: CorpusDoc; chunks: Chunk[]; entry: ManifestEntry }[] = [];

  for (const doc of targets) {
    const path = resolve(CORPUS_DIR, doc.file);
    const fileSha256 = await sha256OfFile(path);
    const previous = manifest.documents[doc.source];
    const unchanged =
      previous?.fileSha256 === fileSha256 &&
      previous.embeddingModel === env.embeddingModel &&
      STAGE_ORDER.indexOf(previous.stageReached) >= STAGE_ORDER.indexOf(stopAfter);

    if (unchanged && !options.force) {
      console.log(`\n${doc.source}: unchanged since ${previous.ingestedAt}, skipping (--force to re-run)`);
      continue;
    }

    console.log(`\n${doc.source}: ${doc.file}`);
    const extracted = await extractDoc(doc);
    console.log(
      `  extracted ${extracted.stats.pdfPages}pp -> ${extracted.stats.lines} lines ` +
        `(${extracted.stats.headings} headings, ${extracted.stats.bodyLines} body, ` +
        `${extracted.stats.minorLines} dropped), ${extracted.stats.characters.toLocaleString()} chars`,
    );
    if (extracted.stats.emptyPages > 0) {
      console.log(`  note: ${extracted.stats.emptyPages} page(s) yielded almost no text layer`);
    }

    const chunks = reached('chunk', stopAfter) ? chunkDoc(extracted) : [];
    const cStats = chunkStats(chunks);
    if (chunks.length > 0) {
      console.log(
        `  chunked -> ${cStats.chunks} chunks, median ~${cStats.medianTokens} tokens, ` +
          `${cStats.withSectionPath} with a section path`,
      );
    }

    pending.push({
      doc,
      chunks,
      entry: {
        source: doc.source,
        file: doc.file,
        fileSha256,
        docTitle: doc.docTitle,
        ingestedAt: new Date().toISOString(),
        stageReached: reached('chunk', stopAfter) ? 'chunk' : 'extract',
        extract: extracted.stats,
        chunk: cStats,
        contextualized: 0,
        embedded: 0,
        loaded: 0,
        deletedStale: 0,
        embeddingModel: env.embeddingModel,
        contextModel: env.contextModel,
        notes: [...gateNotes],
      },
    });
  }

  if (pending.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  const contexts = new Map<SourceKey, string[]>();

  if (reached('contextualize', stopAfter)) {
    console.log(`\ncontextualize (${env.contextModel} on ${env.ollamaBaseUrl})`);
    // Cheapest documents first, so a slow model still gets the small documents
    // done before the time budget starts refusing the large ones.
    const order = [...pending].sort((a, b) => a.chunks.length - b.chunks.length);

    for (const item of order) {
      if (item.chunks.length === 0) continue;

      const probe = await probeContextualizeSpeed(item.doc, item.chunks);
      if (!probe.ok) {
        console.log(`  ${item.doc.source}: skipped (${probe.reason})`);
        item.entry.notes.push(`contextualize skipped: ${probe.reason}`);
        item.entry.stageReached = 'contextualize';
        continue;
      }

      const projectedMs = (probe.msPerChunk * item.chunks.length) / CONTEXTUALIZE_CONCURRENCY;
      if (projectedMs > CONTEXTUALIZE_BUDGET_MS) {
        const note =
          `contextualize skipped: ~${minutes(projectedMs)} projected for ${item.chunks.length} ` +
          `chunks at ${(probe.msPerChunk / 1000).toFixed(1)}s/chunk, over the ` +
          `${minutes(CONTEXTUALIZE_BUDGET_MS)} budget; loaded with context_summary = ''`;
        console.log(`  ${item.doc.source}: ${note}`);
        item.entry.notes.push(note);
        item.entry.stageReached = 'contextualize';
        continue;
      }

      console.log(
        `  ${item.doc.source}: ${item.chunks.length} chunks at ` +
          `~${(probe.msPerChunk / 1000).toFixed(1)}s each, ~${minutes(projectedMs)} projected`,
      );
      const result = await contextualizeChunks(item.doc, item.chunks, progressBar(`  ${item.doc.source}`));
      contexts.set(item.doc.source, result.summaries);
      item.entry.contextualized = result.summaries.filter(Boolean).length;
      item.entry.stageReached = 'contextualize';

      if (result.skipped) {
        console.log(`  ${item.doc.source}: skipped (${result.skipReason})`);
        item.entry.notes.push(`contextualize skipped: ${result.skipReason}`);
      } else {
        console.log(
          `  ${item.doc.source}: ${item.entry.contextualized}/${item.chunks.length} summarised, ` +
            `${result.failures} failed, ${minutes(result.elapsedMs)} elapsed`,
        );
        if (result.failures > 0) {
          item.entry.notes.push(`${result.failures} chunk(s) have no context_summary (model errors)`);
        }
      }
    }
  }

  const embeddings = new Map<SourceKey, number[][]>();

  if (reached('embed', stopAfter)) {
    console.log(`\nembed (${env.embeddingModel}, 1024-dim, local -- no API spend)`);
    for (const item of pending) {
      const summaries = contexts.get(item.doc.source) ?? item.chunks.map(() => '');
      const inputs = item.chunks.map((c, i) =>
        embeddingInput(summaries[i] ?? '', c.sectionPath, c.content),
      );
      const started = Date.now();
      const vectors = await embedDocuments(inputs, progressBar(`  ${item.doc.source}`));
      embeddings.set(item.doc.source, vectors);
      item.entry.embedded = vectors.length;
      item.entry.stageReached = 'embed';
      console.log(`  ${item.doc.source}: ${vectors.length} vectors in ${minutes(Date.now() - started)}`);
    }
  }

  if (reached('load', stopAfter)) {
    console.log('\nload');
    const client = serviceClient();
    for (const item of pending) {
      const summaries = contexts.get(item.doc.source) ?? item.chunks.map(() => '');
      const vectors = embeddings.get(item.doc.source);
      const items: LoadableChunk[] = item.chunks.map((chunk, i) => ({
        chunk,
        contextSummary: summaries[i] ?? '',
        embedding: vectors?.[i] ?? null,
      }));
      const result = await loadChunks(client, item.doc.source, items, progressBar(`  ${item.doc.source}`));
      item.entry.loaded = result.upserted;
      item.entry.deletedStale = result.deletedStale;
      item.entry.stageReached = 'load';
      console.log(
        `  ${item.doc.source}: upserted ${result.upserted}, removed ${result.deletedStale} stale row(s)`,
      );
    }
  }

  for (const item of pending) manifest.documents[item.doc.source] = item.entry;
  manifest.updatedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('\nsummary');
  for (const item of pending) {
    console.log(
      `  ${item.doc.source.padEnd(26)} ${String(item.entry.chunk.chunks).padStart(5)} chunks  ` +
        `ctx=${item.entry.contextualized}  embedded=${item.entry.embedded}  ` +
        `loaded=${item.entry.loaded}  stage=${item.entry.stageReached}`,
    );
  }
  console.log(
    `  ${'TOTAL'.padEnd(26)} ${String(pending.reduce((n, i) => n + i.entry.chunk.chunks, 0)).padStart(5)} chunks`,
  );
  console.log(`\nmanifest written to ${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(`\ningestion failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
