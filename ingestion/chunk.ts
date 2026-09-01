import type { ExtractedDoc, Line } from './extract.ts';
import type { SourceKey } from './config.ts';

export interface Chunk {
  source: SourceKey;
  docTitle: string;
  sectionPath: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  /** Position of the chunk within its document, used only for reporting. */
  index: number;
}

export interface ChunkOptions {
  /** Target chunk size in tokens. */
  targetTokens: number;
  /** Fraction of the target repeated from the previous chunk. */
  overlapRatio: number;
  /** Chunks shorter than this are merged into their neighbour or dropped. */
  minTokens: number;
  /** Deepest heading level kept in section_path. */
  maxHeadingDepth: number;
}

/**
 * Sized to the embedding model, not to a round number. mxbai-embed-large accepts
 * 512 tokens and rejects anything longer, and each chunk is embedded together
 * with its context summary and section path, so roughly 100 tokens of that
 * window are already spoken for. 380 leaves headroom for the
 * characters-per-token estimate below being optimistic on dense text such as
 * Sphere's indicator tables -- the estimate is what decided this number, so it
 * is verified by embed.ts reporting zero truncated inputs after a full run.
 */
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  targetTokens: 380,
  overlapRatio: 0.15,
  minTokens: 40,
  maxHeadingDepth: 4,
};

/**
 * Rough token count, using the standard ~4-characters-per-token approximation
 * for English prose. Running the embedding model's own tokenizer per candidate
 * chunk would cost a round trip per line, so this stays an estimate and
 * embed.ts guards the real limit.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const BULLET_RE = /^\s*([•·▪◦‣–—-]|\(?[a-z0-9]{1,3}[.)])\s+/i;

/** Join wrapped lines back into prose, keeping list items on their own lines. */
function joinLines(lines: string[]): string {
  let out = '';
  for (const line of lines) {
    if (!out) {
      out = line;
      continue;
    }
    out += BULLET_RE.test(line) ? '\n' : ' ';
    out += line;
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

class HeadingStack {
  private stack: { size: number; text: string }[] = [];

  constructor(private readonly maxDepth: number) {}

  push(line: Line): void {
    // A heading set in larger type opens a shallower level, so unwind anything
    // at or below its size before pushing it.
    while (this.stack.length > 0 && this.stack[this.stack.length - 1].size <= line.size) {
      this.stack.pop();
    }
    this.stack.push({ size: line.size, text: line.text });
    if (this.stack.length > this.maxDepth) this.stack.shift();
  }

  path(): string {
    return this.stack
      .map((h) => h.text.replace(/\s*[:.]\s*$/, '').trim())
      .filter(Boolean)
      .join(' > ');
  }
}

interface PendingLine {
  text: string;
  page: number;
  tokens: number;
}

function flushSection(
  pending: PendingLine[],
  sectionPath: string,
  doc: ExtractedDoc,
  options: ChunkOptions,
  out: Chunk[],
): void {
  if (pending.length === 0) return;

  const overlapBudget = Math.round(options.targetTokens * options.overlapRatio);
  let cursor = 0;

  while (cursor < pending.length) {
    const taken: PendingLine[] = [];
    let tokens = 0;
    let i = cursor;
    // Stop *before* crossing the target rather than after. Overshooting by a
    // whole line pushed 7% of chunks past the embedding model's window, and
    // those were silently truncated -- the stored content stayed complete and
    // findable by full-text search, but their vectors were missing the tail.
    // A single line longer than the target is still taken whole, since dropping
    // it would lose the text entirely.
    while (i < pending.length) {
      const line = pending[i];
      if (taken.length > 0 && tokens + line.tokens > options.targetTokens) break;
      taken.push(line);
      tokens += line.tokens;
      i++;
    }

    const content = joinLines(taken.map((l) => l.text));
    const pages = taken.map((l) => l.page);
    if (estimateTokens(content) >= options.minTokens || out.length === 0) {
      out.push({
        source: doc.doc.source,
        docTitle: doc.doc.docTitle,
        sectionPath,
        pageStart: Math.min(...pages),
        pageEnd: Math.max(...pages),
        content,
        index: out.length,
      });
    } else if (out.length > 0) {
      // A tail too small to stand alone: append it to the previous chunk rather
      // than emitting a fragment that retrieves badly and cites imprecisely.
      const prev = out[out.length - 1];
      prev.content = `${prev.content}\n${content}`.trim();
      prev.pageEnd = Math.max(prev.pageEnd, Math.max(...pages));
    }

    if (i >= pending.length) break;

    // Step back far enough to repeat ~overlapRatio of the target, so a sentence
    // split across the boundary is still retrievable whole from one side.
    let back = 0;
    let backTokens = 0;
    while (back < taken.length - 1 && backTokens < overlapBudget) {
      backTokens += taken[taken.length - 1 - back].tokens;
      back++;
    }
    cursor = i - back;
  }
}

export function chunkDoc(doc: ExtractedDoc, options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const out: Chunk[] = [];
  const headings = new HeadingStack(options.maxHeadingDepth);
  let pending: PendingLine[] = [];
  let sectionPath = '';

  for (const line of doc.lines) {
    // Running heads, folios, figure labels and footnote scraps: excluded from
    // chunk content, since they retrieve as noise and never as an answer.
    if (line.kind === 'minor') continue;

    if (line.kind === 'heading') {
      // A heading ends the section it follows, so chunks never span two
      // sections and every chunk's section_path is exact.
      flushSection(pending, sectionPath, doc, options, out);
      pending = [];
      headings.push(line);
      sectionPath = headings.path();
      continue;
    }

    pending.push({ text: line.text, page: line.page, tokens: estimateTokens(line.text) });
  }

  flushSection(pending, sectionPath, doc, options, out);
  return out;
}

export interface ChunkStats {
  chunks: number;
  totalTokens: number;
  medianTokens: number;
  minTokens: number;
  maxTokens: number;
  withSectionPath: number;
}

export function chunkStats(chunks: Chunk[]): ChunkStats {
  const tokens = chunks.map((c) => estimateTokens(c.content)).sort((a, b) => a - b);
  return {
    chunks: chunks.length,
    totalTokens: tokens.reduce((a, b) => a + b, 0),
    medianTokens: tokens.length ? tokens[Math.floor(tokens.length / 2)] : 0,
    minTokens: tokens.length ? tokens[0] : 0,
    maxTokens: tokens.length ? tokens[tokens.length - 1] : 0,
    withSectionPath: chunks.filter((c) => c.sectionPath).length,
  };
}
