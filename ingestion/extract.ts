import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDocumentProxy } from 'unpdf';

import { CORPUS_DIR, type CorpusDoc } from './config.ts';

export type LineKind = 'heading' | 'body' | 'minor';

export interface Line {
  /** 1-based index of the page in the PDF file. */
  pdfPage: number;
  /** Printed page number if the PDF declares numeric page labels, else pdfPage. */
  page: number;
  column: number;
  text: string;
  size: number;
  kind: LineKind;
}

export interface ExtractStats {
  pdfPages: number;
  lines: number;
  headings: number;
  bodyLines: number;
  minorLines: number;
  characters: number;
  /** Pages whose text layer produced almost nothing — a scanned-image page. */
  emptyPages: number;
  maxColumnsOnAPage: number;
  dehyphenatedExplicit: number;
  dehyphenatedInferred: number;
  bodyFontSize: number;
  usesPrintedPageLabels: boolean;
}

export interface ExtractedDoc {
  doc: CorpusDoc;
  lines: Line[];
  stats: ExtractStats;
}

interface RawItem {
  str: string;
  x: number;
  right: number;
  y: number;
  size: number;
  font: string;
}

interface RawLine {
  pdfPage: number;
  page: number;
  column: number;
  y: number;
  x: number;
  right: number;
  size: number;
  font: string;
  text: string;
  /** Right edge of the widest line in this line's column, for hyphen detection. */
  columnRight: number;
}

/** Ignore glyph runs smaller than this; they are always decoration, never prose. */
const MIN_MEANINGFUL_SIZE = 4;

/**
 * Fonts in this corpus map some glyphs to control codepoints -- the IASC
 * disability guidelines emit U+0007 where a word space belongs, which then
 * shows up inside section_path and inside tsvector lexemes. Replace them with
 * spaces, normalise, and expand the ligatures pdf.js leaves as single glyphs so
 * that "office" and "oﬃce" are the same search term.
 */
const LIGATURES: [RegExp, string][] = [
  [/ﬀ/g, 'ff'],
  [/ﬁ/g, 'fi'],
  [/ﬂ/g, 'fl'],
  [/ﬃ/g, 'ffi'],
  [/ﬄ/g, 'ffl'],
  [/ﬅ|ﬆ/g, 'st'],
];

function cleanText(raw: string): string {
  let text = raw.normalize('NFC');
  for (const [re, replacement] of LIGATURES) text = text.replace(re, replacement);
  return text
    // C0/C1 control codes stand in for spaces in these fonts.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    // Zero-width characters split a word into two lexemes invisibly.
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    // Non-breaking and typographic spaces, so tsvector and display agree.
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ');
}

/**
 * Split a page into columns by finding vertical gutters: x ranges that almost no
 * text row crosses. A few full-width rows (running heads, spread titles) are
 * tolerated, otherwise a single banner across the top would erase the gutter
 * beneath it — which is exactly what happens on the two-up landscape spreads in
 * the IASC disability guidelines.
 */
function detectColumns(items: RawItem[], pageWidth: number): number[] {
  if (items.length === 0) return [0, pageWidth];

  const rows = new Map<number, RawItem[]>();
  for (const it of items) {
    const key = Math.round(it.y / 4);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(it);
  }
  const rowCount = rows.size;
  if (rowCount < 6) return [0, pageWidth];

  const bins = Math.max(1, Math.ceil(pageWidth));
  const coverage = new Int32Array(bins);
  for (const rowItems of rows.values()) {
    const covered = new Set<number>();
    for (const it of rowItems) {
      const from = Math.max(0, Math.floor(it.x));
      const to = Math.min(bins - 1, Math.ceil(it.right));
      for (let b = from; b <= to; b++) covered.add(b);
    }
    for (const b of covered) coverage[b]++;
  }

  // A bin belongs to a gutter when at most 5% of rows put ink in it.
  const threshold = Math.max(1, Math.floor(rowCount * 0.05));
  const textLeft = Math.floor(Math.min(...items.map((i) => i.x)));
  const textRight = Math.ceil(Math.max(...items.map((i) => i.right)));
  // A gutter must be wider than a word space, so scale the threshold to the
  // type size rather than to the page: the disability guidelines are landscape
  // two-up spreads whose 13pt gutters are a rounding error against page width.
  const sizes = items.map((i) => i.size).sort((a, b) => a - b);
  const medianSize = sizes[Math.floor(sizes.length / 2)];
  const minGutter = Math.max(8, medianSize * 1.3);

  const boundaries = [textLeft];
  let runStart = -1;
  for (let b = textLeft; b <= textRight; b++) {
    const isGutter = coverage[b] <= threshold;
    if (isGutter && runStart === -1) runStart = b;
    if ((!isGutter || b === textRight) && runStart !== -1) {
      const runEnd = isGutter ? b : b - 1;
      if (runEnd - runStart + 1 >= minGutter && runStart > textLeft) {
        boundaries.push((runStart + runEnd) / 2);
      }
      runStart = -1;
    }
  }
  boundaries.push(textRight + 1);
  return boundaries;
}

function columnOf(item: RawItem, boundaries: number[]): number {
  // Assign by the item's midpoint so a word that slightly overhangs a boundary
  // still lands in the column it visually belongs to.
  const mid = (item.x + item.right) / 2;
  for (let i = boundaries.length - 2; i >= 0; i--) {
    if (mid >= boundaries[i]) return i;
  }
  return 0;
}

function buildLines(items: RawItem[], pdfPage: number, page: number, pageWidth: number): RawLine[] {
  const boundaries = detectColumns(items, pageWidth);
  const byColumnRow = new Map<string, RawItem[]>();

  for (const it of items) {
    const col = columnOf(it, boundaries);
    // Round y to a fraction of the glyph height so superscripts and slightly
    // shifted runs stay on the line they belong to.
    const key = `${col}:${Math.round(it.y / Math.max(2, it.size * 0.5))}`;
    if (!byColumnRow.has(key)) byColumnRow.set(key, []);
    byColumnRow.get(key)!.push(it);
  }

  const lines: RawLine[] = [];
  for (const [key, rowItems] of byColumnRow) {
    const column = Number(key.split(':')[0]);
    rowItems.sort((a, b) => a.x - b.x);

    let text = '';
    for (let i = 0; i < rowItems.length; i++) {
      const it = rowItems[i];
      // pdf.js emits a separate item per style run; runs within a word are
      // adjacent, so only insert a space where there is a visible gap.
      const needsSpace =
        i > 0 &&
        text.length > 0 &&
        !/\s$/.test(text) &&
        !/^\s/.test(it.str) &&
        it.x - rowItems[i - 1].right > it.size * 0.18;
      text += (needsSpace ? ' ' : '') + it.str;
    }
    text = cleanText(text).replace(/\s+/g, ' ').trim();
    if (!text) continue;

    // Attribute the line to whichever style run contributed the most characters,
    // so a footnote marker does not reclassify a body line as a heading.
    const dominant = rowItems.reduce((a, b) => (b.str.length > a.str.length ? b : a));
    lines.push({
      pdfPage,
      page,
      column,
      y: Math.max(...rowItems.map((i) => i.y)),
      x: Math.min(...rowItems.map((i) => i.x)),
      right: Math.max(...rowItems.map((i) => i.right)),
      size: Math.round(dominant.size * 2) / 2,
      font: dominant.font,
      text,
      columnRight: 0,
    });
  }

  // Reading order: columns left to right, rows top to bottom within a column.
  lines.sort((a, b) => (a.column !== b.column ? a.column - b.column : b.y - a.y));

  const columnRights = new Map<number, number>();
  for (const l of lines) columnRights.set(l.column, Math.max(columnRights.get(l.column) ?? 0, l.right));
  for (const l of lines) l.columnRight = columnRights.get(l.column) ?? l.right;

  return lines;
}

/** Character-weighted modal font size, i.e. the size the body text is set in. */
function modalSize(lines: RawLine[]): number {
  const weight = new Map<number, number>();
  for (const l of lines) weight.set(l.size, (weight.get(l.size) ?? 0) + l.text.length);
  let best = 10;
  let bestWeight = -1;
  for (const [size, w] of weight) {
    if (w > bestWeight) {
      best = size;
      bestWeight = w;
    }
  }
  return best;
}

/**
 * Headings the corpus states in a fixed form. Font size alone misses these:
 * Sphere sets "Water supply standard 2.1" at body size in a bold cut, and CHS
 * sets its commitments the same way.
 */
const HEADING_PATTERNS: RegExp[] = [
  /^(appendix|annex|chapter|section|part)\s+[0-9ivxlc]+\b/i,
  // Numbered section titles. Bounded and period-free so that Sphere's numbered
  // key actions, which open the same way but run on as sentences, do not match.
  /^\d+(\.\d+)*[.)]?\s+\p{Lu}[^.]{0,58}$/u,
  /\bstandard\s+\d+(\.\d+)*\s*:/i,
  /^commitment\s+\d+\b/i,
  /^(protection\s+)?principle\s+\d+\b/i,
  /^(key actions|key indicators|guidance notes|must-do actions|references and further reading)\b/i,
];

function looksLikeRunningHeadOrFolio(text: string): boolean {
  // Bare folios, and "93 | WASH"-style running feet.
  return /^[0-9ivxlcdm]{1,6}$/i.test(text) || /^[0-9]{1,4}\s*[|·•]\s*\S/.test(text);
}

function classify(line: RawLine, bodySize: number): LineKind {
  const t = line.text;
  if (looksLikeRunningHeadOrFolio(t)) return 'minor';
  // Figure labels, callout boxes and footnotes are set well below body size.
  if (line.size < bodySize * 0.82) return 'minor';
  // Lone symbols and cross-reference glyphs carry no text.
  if ((t.match(/\p{L}/gu) ?? []).length < 3) return 'minor';

  const short = t.length <= 90;
  // Larger type than the body is the only reliable structural signal: pdf.js
  // exposes font *ids*, not weights, so bold cannot be detected directly.
  if (short && line.size >= bodySize + 0.5) return 'heading';
  // Headings the corpus states in a fixed form sit at body size. Two guards:
  // a heading starts a line (not a mid-sentence cross-reference to another
  // standard) and is not itself a sentence (Sphere's numbered key actions open
  // exactly like numbered section titles).
  if (short && /^[\p{Lu}\d]/u.test(t) && !/[.;,]$/.test(t) && HEADING_PATTERNS.some((re) => re.test(t))) {
    return 'heading';
  }
  return 'body';
}

const WORD_RE = /[\p{L}']+/gu;

/**
 * Some PDFs in this corpus drop the soft hyphen at a line break entirely (the
 * Sphere handbook does: "estab" / "lish"), so there is no character to key on.
 * Rather than depend on an external dictionary, use the document itself as the
 * lexicon: a token that shows up mid-line elsewhere is a real word and must not
 * be glued to the next line, while a fragment that never appears mid-line but
 * whose join does is a broken word.
 */
function buildMidLineLexicon(lines: RawLine[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const words = l.text.toLowerCase().match(WORD_RE);
    if (!words) continue;
    // Drop the final token: at a line break we cannot tell whether it is whole.
    for (let i = 0; i < words.length - 1; i++) {
      counts.set(words[i], (counts.get(words[i]) ?? 0) + 1);
    }
  }
  return counts;
}

interface JoinResult {
  lines: RawLine[];
  explicit: number;
  inferred: number;
}

function dehyphenate(lines: RawLine[], lexicon: Map<string, number>): JoinResult {
  const out: RawLine[] = [];
  let explicit = 0;
  let inferred = 0;

  for (const line of lines) {
    const prev = out[out.length - 1];
    const sameFlow =
      prev !== undefined &&
      prev.column === line.column &&
      prev.pdfPage === line.pdfPage &&
      prev.size === line.size;

    if (sameFlow) {
      // Explicit hyphen or soft hyphen at the break.
      const m = /(\p{Ll}{2,})[-­‐‑]$/u.exec(prev.text);
      const nextWord = /^(\p{Ll}{2,})/u.exec(line.text);
      if (m && nextWord) {
        prev.text = prev.text.replace(/[-­‐‑]$/u, '') + line.text;
        prev.right = line.right;
        explicit++;
        continue;
      }

      // Dropped hyphen: the line stops just short of the column edge by roughly
      // one hyphen width, and the lexicon says the trailing token is a fragment.
      const gap = prev.columnRight - prev.right;
      const tail = /(\p{Ll}{3,})$/u.exec(prev.text);
      if (nextWord && tail && gap > 1.5 && gap < prev.size) {
        const fragment = tail[1].toLowerCase();
        const joined = fragment + nextWord[1].toLowerCase();
        const fragmentIsAWord = (lexicon.get(fragment) ?? 0) >= 2;
        const joinIsAWord = (lexicon.get(joined) ?? 0) >= 1;
        if (!fragmentIsAWord && joinIsAWord) {
          prev.text += line.text;
          prev.right = line.right;
          inferred++;
          continue;
        }
      }
    }

    out.push({ ...line });
  }

  return { lines: out, explicit, inferred };
}

/**
 * Markdown text sources (HTML-derived "about"/documentation pages, saved by hand
 * since the pages that produced them render client-side or sit behind a WAF).
 * No PDF-specific problems apply -- no columns, no dropped hyphens, no running
 * heads -- so this path skips straight to classified lines: a `#`-prefixed line
 * is a heading (depth becomes a descending synthetic size so chunk.ts's
 * size-ordered HeadingStack nests them correctly), everything else is body.
 */
async function extractMarkdownDoc(doc: CorpusDoc): Promise<ExtractedDoc> {
  const raw = await readFile(resolve(CORPUS_DIR, doc.file), 'utf8');
  const lines: Line[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const text = cleanText(rawLine).trim();
    if (!text) continue;

    const heading = /^(#{1,6})\s+(.*)$/.exec(text);
    if (heading) {
      lines.push({
        pdfPage: 1,
        page: 1,
        column: 0,
        text: heading[2].replace(/\s+/g, ' ').trim(),
        size: 20 - heading[1].length,
        kind: 'heading',
      });
      continue;
    }

    lines.push({
      pdfPage: 1,
      page: 1,
      column: 0,
      text: text.replace(/\s+/g, ' ').trim(),
      size: 10,
      kind: 'body',
    });
  }

  const stats: ExtractStats = {
    pdfPages: 1,
    lines: lines.length,
    headings: lines.filter((l) => l.kind === 'heading').length,
    bodyLines: lines.filter((l) => l.kind === 'body').length,
    minorLines: 0,
    characters: lines.reduce((n, l) => n + l.text.length, 0),
    emptyPages: 0,
    maxColumnsOnAPage: 1,
    dehyphenatedExplicit: 0,
    dehyphenatedInferred: 0,
    bodyFontSize: 10,
    usesPrintedPageLabels: false,
  };

  return { doc, lines, stats };
}

export async function extractDoc(doc: CorpusDoc): Promise<ExtractedDoc> {
  if (doc.file.endsWith('.md') || doc.file.endsWith('.txt')) {
    return extractMarkdownDoc(doc);
  }

  const bytes = new Uint8Array(await readFile(resolve(CORPUS_DIR, doc.file)));
  const pdf = await getDocumentProxy(bytes);
  const labels: (string | null)[] | null = await pdf.getPageLabels().catch(() => null);
  const usesPrintedPageLabels = Boolean(labels?.some((l) => l && /^\d+$/.test(l)));

  const rawLines: RawLine[] = [];
  let emptyPages = 0;
  let maxColumnsOnAPage = 1;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items: RawItem[] = [];
    for (const raw of content.items as unknown[]) {
      const it = raw as { str?: string; width?: number; transform?: number[]; fontName?: string };
      if (!it.str || !it.str.trim() || !it.transform) continue;
      const size = Math.hypot(it.transform[2], it.transform[3]);
      if (size < MIN_MEANINGFUL_SIZE) continue;
      items.push({
        str: it.str,
        x: it.transform[4],
        right: it.transform[4] + (it.width ?? 0),
        y: it.transform[5],
        size,
        font: it.fontName ?? '',
      });
    }

    const chars = items.reduce((n, i) => n + i.str.trim().length, 0);
    if (chars < 40) emptyPages++;

    const printed = usesPrintedPageLabels ? labels?.[p - 1] : null;
    const pageNumber = printed && /^\d+$/.test(printed) ? Number(printed) : p;

    const pageLines = buildLines(items, p, pageNumber, viewport.width);
    maxColumnsOnAPage = Math.max(maxColumnsOnAPage, new Set(pageLines.map((l) => l.column)).size);
    rawLines.push(...pageLines);
  }

  const bodySize = modalSize(rawLines);
  const lexicon = buildMidLineLexicon(rawLines);
  const joined = dehyphenate(rawLines, lexicon);

  // Body size per page, not per document: the IASC protection policy sets its
  // annexes a point and a half larger than its main text, and a document-wide
  // modal size turns every line of those annexes into a heading. Short pages
  // have no reliable mode of their own, so they fall back to the document's.
  const linesByPage = new Map<number, RawLine[]>();
  for (const l of joined.lines) {
    if (!linesByPage.has(l.pdfPage)) linesByPage.set(l.pdfPage, []);
    linesByPage.get(l.pdfPage)!.push(l);
  }
  const pageBodySize = new Map<number, number>();
  for (const [pdfPage, pageLines] of linesByPage) {
    const chars = pageLines.reduce((n, l) => n + l.text.length, 0);
    pageBodySize.set(pdfPage, chars >= 400 ? modalSize(pageLines) : bodySize);
  }

  const lines: Line[] = joined.lines.map((l) => ({
    pdfPage: l.pdfPage,
    page: l.page,
    column: l.column,
    text: l.text.replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim(),
    size: l.size,
    kind: classify(l, pageBodySize.get(l.pdfPage) ?? bodySize),
  }));

  const stats: ExtractStats = {
    pdfPages: pdf.numPages,
    lines: lines.length,
    headings: lines.filter((l) => l.kind === 'heading').length,
    bodyLines: lines.filter((l) => l.kind === 'body').length,
    minorLines: lines.filter((l) => l.kind === 'minor').length,
    characters: lines.reduce((n, l) => n + l.text.length, 0),
    emptyPages,
    maxColumnsOnAPage,
    dehyphenatedExplicit: joined.explicit,
    dehyphenatedInferred: joined.inferred,
    bodyFontSize: bodySize,
    usesPrintedPageLabels,
  };

  return { doc, lines, stats };
}
