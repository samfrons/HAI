/**
 * The self-check: does the section actually say what the evidence supports?
 *
 * This is the step that makes the rest of the feature defensible. Everything
 * before it — the tools, the per-section evidence, the citation ids — makes
 * grounding *likely*. None of it makes grounding *checked*. A model handed six
 * passages and asked for 200 words will occasionally produce a figure that is
 * in none of them, and it will produce that figure in exactly the same
 * confident register as the five that are, because a language model has no
 * privileged access to which of its own sentences were retrieved.
 *
 * So every factual sentence is pulled back out of the draft and matched against
 * the evidence that section was given. Three verdicts:
 *
 * - `supported`     — the evidence contains it.
 * - `unsupported`   — the evidence covers the topic and does not say this, or
 *                     says something else.
 * - `unverifiable`  — the evidence is silent; nothing here can settle it.
 *
 * The last two are marked in the prose, not removed. Deleting an unverified
 * claim would produce a shorter document that reads as entirely verified, which
 * is worse than the problem: the reader loses both the claim and the warning.
 * A flagged sentence tells an analyst precisely where to look.
 *
 * # Why two passes
 *
 * The cheap pass is string and figure matching, and it settles most sentences
 * for free. It cannot settle paraphrase — "roughly a quarter of the population"
 * against "24.6%" — so what it cannot settle goes to one batched model call per
 * section. One call, not one per claim: six sections times six claims would be
 * thirty-six extra requests, which neither the token budget nor anyone's
 * patience survives.
 *
 * The default when the check itself fails or returns nonsense is
 * `unverifiable`, i.e. flag it. A verifier that fails open verifies nothing.
 */

import { generateText, type LanguageModel } from 'ai';

import { getProviderOptions } from '@/lib/llm/provider';

import { formatEvidence, type EvidenceItem } from './evidence';
import { TokenPacer, estimateTokens, withRateLimitRetry } from './pacer';
import { UNVERIFIED_MARK } from './render';
import type { Verdict } from './types';

export interface ClaimCheck {
  claim: string;
  verdict: Verdict;
  /** Evidence label that supports it, where one does. */
  source?: string;
}

export interface VerificationResult {
  checks: ClaimCheck[];
  /** The section with unsupported/unverifiable claims marked in place. */
  markdown: string;
  flagged: number;
}

/**
 * Claims checked per section.
 *
 * Six covers a 200-word section's factual load with room over, and caps what
 * the batched check costs. Sentences beyond the cap are left unmarked rather
 * than marked unverified — claiming to have checked something that was never
 * looked at is the one outcome worse than not checking.
 */
const MAX_CLAIMS = 6;

/** Lexical overlap at which a claim and an evidence item are about one thing. */
const TOPIC_OVERLAP = 0.34;

const STOPWORDS = new Set([
  'about', 'above', 'after', 'against', 'among', 'around', 'because', 'been', 'before',
  'being', 'between', 'both', 'during', 'each', 'from', 'have', 'having', 'into', 'more',
  'most', 'other', 'over', 'same', 'some', 'such', 'than', 'that', 'their', 'them',
  'these', 'they', 'this', 'those', 'through', 'under', 'until', 'were', 'what', 'when',
  'where', 'which', 'while', 'with', 'within', 'would', 'there', 'also', 'across',
]);

/* ------------------------------------------------------------------ *
 * Claim extraction
 * ------------------------------------------------------------------ */

/** Words that make a sentence a factual assertion rather than framing. */
const FACTUAL_PATTERN =
  /\b(sphere|chs|iasc|ipc|standard|indicator|commitment|threshold|minimum|litres|liters|per\s+person|per\s+day|per\s+capita|phase\s+\d|cluster|appeal|funded|funding|requirement|caseload|displaced|refugees?|idps?|malnutrition|mortality|coverage)\b/i;

/**
 * Pull the checkable sentences out of a section.
 *
 * Split on sentence boundaries and on list-item boundaries, since a brief's
 * factual load is mostly in bullets and table rows rather than prose. Anything
 * carrying a figure is checkable by definition; anything naming a standard or a
 * humanitarian indicator is checkable too, because a wrong section number is as
 * damaging as a wrong number and much harder to spot.
 */
export function extractClaims(markdown: string): string[] {
  const claims: string[] = [];

  for (const line of markdown.split('\n')) {
    const text = line
      .replace(/^\s*([-*+]|\d+[.)])\s+/, '')   // list markers
      .replace(/^\s*\|?\s*/, '')               // table cell leader
      .replace(/^#{1,6}\s+/, '')               // stray heading
      .trim();
    if (!text || /^[-|:\s]+$/.test(text)) continue;

    // Sentence split that does not break on "24.6%" or "No. 3".
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
    for (const sentence of sentences) {
      const claim = sentence.trim();
      if (claim.length < 25) continue;
      const hasFigure = /\d/.test(claim);
      if (!hasFigure && !FACTUAL_PATTERN.test(claim)) continue;
      claims.push(claim);
      if (claims.length >= MAX_CLAIMS) return claims;
    }
  }

  return claims;
}

/* ------------------------------------------------------------------ *
 * Deterministic pass
 * ------------------------------------------------------------------ */

/**
 * Digit runs with thousands separators removed, so a claim's "1,200,000"
 * matches an evidence item's "1 200 000" or "1200000".
 *
 * The group pattern is deliberately narrow — a separator is consumed only when
 * exactly three digits follow it. A looser `[\d,\s]*` reads "IPC Phase 3 4" as
 * the number 34, which would then "match" evidence containing 34 of anything.
 * Single digits are dropped for the same reason: they occur everywhere and so
 * discriminate nothing.
 */
function figuresIn(text: string): string[] {
  const found = text.match(/\d+(?:[,\u00a0\u202f ]\d{3})*(?:\.\d+)?/g) ?? [];
  return found
    .map((figure) => figure.replace(/[,\u00a0\u202f ]/g, ''))
    .filter((figure) => figure.length >= 2);
}

function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return new Set(words.filter((word) => !STOPWORDS.has(word)));
}

function overlap(claim: Set<string>, evidence: Set<string>): number {
  if (claim.size === 0) return 0;
  let shared = 0;
  for (const word of claim) if (evidence.has(word)) shared += 1;
  return shared / claim.size;
}

interface Prepared {
  item: EvidenceItem;
  figures: Set<string>;
  words: Set<string>;
}

/**
 * Settle a claim on string evidence alone, or return undefined to defer.
 *
 * A claim with figures is supported only by an item that contains all of them
 * *and* is about the same subject — the conjunction matters, because "3" and
 * "2018" turn up in unrelated passages constantly, and matching on figures
 * alone would wave through a caseload attributed to the wrong dataset.
 */
function checkDeterministically(claim: string, prepared: Prepared[]): ClaimCheck | undefined {
  const claimFigures = figuresIn(claim);
  const claimWords = contentWords(claim);

  // The draft cites by source label in parentheses; when that label names a
  // real evidence item, check that item first and hardest.
  for (const candidate of prepared) {
    if (!claim.includes(`(${candidate.item.label})`)) continue;
    const figuresHeld = claimFigures.every((figure) => candidate.figures.has(figure));
    if (figuresHeld && overlap(claimWords, candidate.words) >= TOPIC_OVERLAP) {
      return { claim, verdict: 'supported', source: candidate.item.label };
    }
  }

  for (const candidate of prepared) {
    if (claimFigures.length === 0) continue;
    const figuresHeld = claimFigures.every((figure) => candidate.figures.has(figure));
    if (figuresHeld && overlap(claimWords, candidate.words) >= TOPIC_OVERLAP) {
      return { claim, verdict: 'supported', source: candidate.item.label };
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ *
 * Model pass
 * ------------------------------------------------------------------ */

const VERDICTS: Record<string, Verdict> = {
  supported: 'supported',
  unsupported: 'unsupported',
  unverifiable: 'unverifiable',
};

async function checkWithModel(
  claims: string[],
  evidence: EvidenceItem[],
  ctx: { model: LanguageModel; pacer: TokenPacer; signal?: AbortSignal },
): Promise<Map<number, ClaimCheck>> {
  const results = new Map<number, ClaimCheck>();
  if (claims.length === 0) return results;

  const prompt = `You are checking a draft against the evidence it was written from. Judge only what the evidence says. Your own knowledge is irrelevant and must not be used.

EVIDENCE:
${formatEvidence(evidence, 2_600)}

CLAIMS:
${claims.map((claim, index) => `${index + 1}. ${claim}`).join('\n')}

For each claim output exactly one line, no other text:
<number>|<supported|unsupported|unverifiable>|<evidence label, or ->

supported    = the evidence states this, including the figure and its period
unsupported  = the evidence covers this topic and does not say it, or says otherwise
unverifiable = the evidence does not address it at all`;

  const estimated = estimateTokens(prompt, 30 * claims.length);
  await ctx.pacer.reserve(estimated);

  const result = await withRateLimitRetry(() =>
    generateText({
      model: ctx.model,
      providerOptions: getProviderOptions(),
      prompt,
      temperature: 0,
      maxOutputTokens: 40 * claims.length + 60,
      abortSignal: ctx.signal,
    }),
  );
  ctx.pacer.settle(estimated, result.usage?.totalTokens ?? estimated);

  for (const line of result.text.split('\n')) {
    const match = /^\s*(\d+)\s*\|\s*([a-z]+)\s*(?:\|\s*(.*))?$/i.exec(line.trim());
    if (!match) continue;
    const index = Number.parseInt(match[1], 10) - 1;
    if (index < 0 || index >= claims.length) continue;
    const verdict = VERDICTS[match[2].toLowerCase()];
    if (!verdict) continue;
    const source = match[3]?.trim();
    results.set(index, {
      claim: claims[index],
      verdict,
      source: source && source !== '-' ? source : undefined,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export interface VerifyInput {
  sectionId: string;
  markdown: string;
  evidence: EvidenceItem[];
  model: LanguageModel;
  pacer: TokenPacer;
  signal?: AbortSignal;
}

export async function verifySection(input: VerifyInput): Promise<VerificationResult> {
  const claims = extractClaims(input.markdown);
  if (claims.length === 0) {
    return { checks: [], markdown: input.markdown, flagged: 0 };
  }

  // A section drafted with no evidence at all: nothing can support anything, and
  // there is no point spending a model call to be told so.
  if (input.evidence.length === 0) {
    const checks = claims.map<ClaimCheck>((claim) => ({ claim, verdict: 'unverifiable' }));
    return {
      checks,
      markdown: annotate(input.markdown, checks),
      flagged: checks.length,
    };
  }

  const prepared: Prepared[] = input.evidence.map((item) => ({
    item,
    figures: new Set(figuresIn(item.text)),
    words: contentWords(`${item.label} ${item.text}`),
  }));

  const settled = new Map<number, ClaimCheck>();
  const deferred: string[] = [];
  const deferredIndex: number[] = [];

  claims.forEach((claim, index) => {
    const decided = checkDeterministically(claim, prepared);
    if (decided) settled.set(index, decided);
    else {
      deferred.push(claim);
      deferredIndex.push(index);
    }
  });

  let judged = new Map<number, ClaimCheck>();
  try {
    judged = await checkWithModel(deferred, input.evidence, input);
  } catch {
    // Fall through: every deferred claim stays unverifiable below. The engine
    // records the failure as a caveat, so the reader learns the check did not
    // run rather than being shown flags they cannot interpret.
  }

  const checks: ClaimCheck[] = claims.map((claim, index) => {
    const direct = settled.get(index);
    if (direct) return direct;
    const position = deferredIndex.indexOf(index);
    return judged.get(position) ?? { claim, verdict: 'unverifiable' };
  });

  const flagged = checks.filter((check) => check.verdict !== 'supported').length;
  return { checks, markdown: annotate(input.markdown, checks), flagged };
}

/**
 * Mark flagged claims in the prose.
 *
 * The mark goes immediately after the claim, because a footnote at the end of
 * the section is a footnote nobody reads when they copy one bullet out of it.
 * Claims are exact substrings of the markdown — they were split out of it — so
 * this is a literal insertion rather than a fuzzy match, and a claim that
 * somehow fails to locate is skipped rather than mangling the section.
 */
export function annotate(markdown: string, checks: ClaimCheck[]): string {
  let output = markdown;
  for (const check of checks) {
    if (check.verdict === 'supported') continue;
    const at = output.indexOf(check.claim);
    if (at === -1) continue;
    const end = at + check.claim.length;
    output = `${output.slice(0, end)} ${UNVERIFIED_MARK}${output.slice(end)}`;
  }
  return output;
}
