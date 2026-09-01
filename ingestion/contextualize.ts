import type { Chunk } from './chunk.ts';
import { env, type CorpusDoc } from './config.ts';
import { ollamaHasModel, ollamaReachable } from './embed.ts';

/**
 * Anthropic's contextual retrieval, run against a local model: prepend a short,
 * document-aware preamble to each chunk before embedding it, so a chunk that
 * says "a minimum of 15 litres" still retrieves for "Sphere water quantity
 * standard" even though neither "Sphere" nor "standard" appears in the chunk.
 *
 * The published technique puts the *whole* document in a cached prompt. That is
 * not available here -- there is no prompt cache on a local server, and the
 * Sphere handbook alone is far larger than a 14B model's practical context. The
 * prefix is instead a digest (title, description, section outline), which is
 * what the preamble actually needs to situate a chunk.
 */

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 180_000;
/** One or two sentences; enough headroom that a reply is never cut mid-sentence. */
const MAX_OUTPUT_TOKENS = 160;

export interface ContextualizeResult {
  /** context_summary per chunk, index-aligned with the input chunks. */
  summaries: string[];
  skipped: boolean;
  skipReason: string;
  failures: number;
  elapsedMs: number;
}

function buildDigest(doc: CorpusDoc, chunks: Chunk[]): string {
  const seen = new Set<string>();
  const outline: string[] = [];
  for (const c of chunks) {
    if (!c.sectionPath || seen.has(c.sectionPath)) continue;
    seen.add(c.sectionPath);
    outline.push(c.sectionPath);
  }

  const MAX_OUTLINE_LINES = 200;
  const shown =
    outline.length <= MAX_OUTLINE_LINES
      ? outline
      : [
          ...outline.slice(0, MAX_OUTLINE_LINES / 2),
          `... (${outline.length - MAX_OUTLINE_LINES} further sections omitted) ...`,
          ...outline.slice(-MAX_OUTLINE_LINES / 2),
        ];

  return [
    '<document>',
    `<title>${doc.docTitle}</title>`,
    `<about>${doc.blurb}</about>`,
    '<outline>',
    ...shown,
    '</outline>',
    '</document>',
  ].join('\n');
}

const SYSTEM_INSTRUCTION = [
  'You situate excerpts from humanitarian standards documents so that they can be found by search.',
  'You are given a description and section outline of one document, then a single excerpt from it.',
  'Reply with one or two sentences, at most 50 words, stating what the excerpt is about and where it sits in the document.',
  'Name the document, the sector or thematic area, and the standard, commitment or principle the excerpt belongs to whenever the section path makes that clear.',
  'Write the context only. Do not add a preamble, do not quote the excerpt, and never use the words "this excerpt" or "this chunk".',
].join(' ');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip the reasoning tags and lead-ins local instruct models tend to emit. */
function cleanSummary(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^(here is|here's|context|summary)\b[:\s-]*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function contextualizeOne(digest: string, chunk: Chunk): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: env.contextModel,
          stream: false,
          options: { temperature: 0, num_predict: MAX_OUTPUT_TOKENS },
          messages: [
            { role: 'system', content: `${SYSTEM_INSTRUCTION}\n\n${digest}` },
            {
              role: 'user',
              content: [
                `<section_path>${chunk.sectionPath || '(none)'}</section_path>`,
                `<pages>${chunk.pageStart}-${chunk.pageEnd}</pages>`,
                '<excerpt>',
                chunk.content,
                '</excerpt>',
              ].join('\n'),
            },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${body.slice(0, 200)}`);
      }

      const json = (await response.json()) as { message?: { content?: string } };
      return cleanSummary(json.message?.content ?? '');
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(2 ** attempt * 500);
    }
  }
  throw new Error('unreachable');
}

/** Time one call so the caller can decide whether the full document is worth it. */
export async function probeContextualizeSpeed(
  doc: CorpusDoc,
  chunks: Chunk[],
): Promise<{ ok: boolean; msPerChunk: number; reason: string }> {
  if (chunks.length === 0) return { ok: true, msPerChunk: 0, reason: '' };
  const digest = buildDigest(doc, chunks);
  const started = Date.now();
  try {
    await contextualizeOne(digest, chunks[Math.floor(chunks.length / 2)]);
    return { ok: true, msPerChunk: Date.now() - started, reason: '' };
  } catch (error) {
    return {
      ok: false,
      msPerChunk: 0,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function contextualizeChunks(
  doc: CorpusDoc,
  chunks: Chunk[],
  onProgress?: (done: number, total: number) => void,
): Promise<ContextualizeResult> {
  const empty = chunks.map(() => '');
  const started = Date.now();

  const skip = (skipReason: string): ContextualizeResult => ({
    summaries: empty,
    skipped: true,
    skipReason,
    failures: 0,
    elapsedMs: 0,
  });

  if (env.skipContextualize) return skip('disabled by SKIP_CONTEXTUALIZE');
  if (!(await ollamaReachable())) return skip(`no Ollama server at ${env.ollamaBaseUrl}`);
  if (!(await ollamaHasModel(env.contextModel))) {
    return skip(`${env.contextModel} is not pulled (ollama pull ${env.contextModel})`);
  }

  const digest = buildDigest(doc, chunks);
  const summaries = [...empty];
  let failures = 0;
  let done = 0;
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= chunks.length) return;
      try {
        summaries[i] = await contextualizeOne(digest, chunks[i]);
      } catch {
        // A chunk without context is still usable: it is embedded and indexed on
        // its own text, just without the contextual-retrieval boost.
        failures++;
      }
      done++;
      onProgress?.(done, chunks.length);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return {
    summaries,
    skipped: false,
    skipReason: '',
    failures,
    elapsedMs: Date.now() - started,
  };
}
