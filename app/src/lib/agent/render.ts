/**
 * Turning drafted section text into the document a reader gets.
 *
 * Pure functions with no server dependencies, because the client imports
 * `assembleDocument` to build the markdown export from exactly the same section
 * bodies it is displaying. An export path that re-derives the document a second
 * way is an export path that will eventually disagree with what was on screen,
 * which for a document someone forwards to a donor is the one bug that must not
 * exist.
 */

import type { EvidenceItem, SourceError } from './evidence';

/**
 * How an unverified claim is marked, and why it is marked in the markdown
 * itself rather than styled by the UI.
 *
 * The document is copied, downloaded, and pasted into other people's reports —
 * that is what it is for. A flag that lives only in the web page's CSS survives
 * none of that, so the sentence would arrive in a donor report looking exactly
 * as authoritative as the sourced ones around it. Bold literal text survives
 * copy-paste into Word, plain-text email, and the .md file alike.
 */
export const UNVERIFIED_MARK = '**[unverified]**';
export const INVENTED_CITATION_MARK = '**[citation not in evidence]**';

/** `[e12]` — the citation form the draft prompt asks for. */
const CITATION_PATTERN = /\[(e\d+)\]/g;

export interface RenderedSection {
  markdown: string;
  /** Citation ids the model produced that no evidence item carries. */
  invented: number;
}

/**
 * Replace evidence ids with their source labels, and expose the ones that
 * refer to nothing.
 *
 * An invented citation is not a formatting problem. `[e9]` in a section whose
 * evidence stopped at `[e6]` means the model produced a claim and then produced
 * a provenance for it, which is the most dangerous single failure mode this
 * whole feature is built to catch — it looks more trustworthy than an uncited
 * sentence, not less. So it is marked in the prose and counted as a flag.
 */
export function renderSection(raw: string, evidence: EvidenceItem[]): RenderedSection {
  const labels = new Map(evidence.map((item) => [item.id, item.label]));
  let invented = 0;

  const body = stripLeadingHeading(raw.trim()).replace(CITATION_PATTERN, (match, id: string) => {
    const label = labels.get(id);
    if (label) return `(${label})`;
    invented += 1;
    return INVENTED_CITATION_MARK;
  });

  return { markdown: body, invented };
}

/**
 * The draft prompt says not to write a heading, and the model writes one
 * roughly one time in five. Left in, the document gets two headings per
 * section — so it is removed here rather than by asking the prompt harder.
 */
function stripLeadingHeading(text: string): string {
  return text.replace(/^#{1,6}\s+.*\n+/, '').trim();
}

/* ------------------------------------------------------------------ *
 * Sources and caveats
 * ------------------------------------------------------------------ */

export interface CaveatsInput {
  evidence: EvidenceItem[];
  errors: SourceError[];
  /** ISO-8601 UTC. */
  generatedAt: string;
  flagged: number;
}

/**
 * The section that makes the rest of the document auditable: what answered,
 * what did not, and when.
 *
 * Ported from `situation.py`'s `errors` list, which appended a "Source issues
 * (degraded sections)" block to every report rather than letting a dead
 * connector fail the run. The reasoning holds exactly: a brief assembled while
 * one source was unreachable is still worth having, and is only safe to use if
 * it says so on its face. A reader who cannot see that the funding figures are
 * missing will assume there were none.
 */
export function renderSourcesAndCaveats(input: CaveatsInput): string {
  const lines: string[] = [];

  const bySource = new Map<string, number>();
  for (const item of input.evidence) {
    const base = item.label.split(' · ')[0];
    bySource.set(base, (bySource.get(base) ?? 0) + 1);
  }

  if (bySource.size > 0) {
    lines.push('**Sources consulted**');
    lines.push('');
    for (const [source, count] of [...bySource].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${source} — ${count} record${count === 1 ? '' : 's'}`);
    }
  } else {
    lines.push('**Sources consulted** — none. No source answered for this brief.');
  }

  lines.push('');
  if (input.errors.length > 0) {
    lines.push('**Source issues (degraded sections)**');
    lines.push('');
    // De-duplicated: one unreachable API fails once per section that asked it,
    // and six identical lines reads as six problems rather than one.
    const seen = new Set<string>();
    for (const error of input.errors) {
      const key = `${error.source}::${error.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- \`${error.source}\` — ${error.message}`);
    }
  } else {
    lines.push('**Source issues** — none. Every source consulted returned data.');
  }

  lines.push('');
  lines.push('**Caveats**');
  lines.push('');
  lines.push(
    input.flagged > 0
      ? `- ${input.flagged} claim${input.flagged === 1 ? '' : 's'} in this document could not be matched to retrieved evidence and ${input.flagged === 1 ? 'is' : 'are'} marked ${UNVERIFIED_MARK} in place. Verify ${input.flagged === 1 ? 'it' : 'them'} against the primary source before using this document externally.`
      : '- Every claim in this document matched retrieved evidence at generation time.',
  );
  lines.push(
    '- Figures carry the reference period of the dataset that supplied them, not the date below. A figure can be current in its source and months out of date in the field.',
  );
  lines.push(
    '- This is a machine-assembled starting point for a human analyst, not a cleared product. It has not been reviewed by anyone.',
  );
  lines.push('');
  lines.push(`_Generated ${input.generatedAt} · HAI_`);

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Document assembly
 * ------------------------------------------------------------------ */

export interface DocumentSection {
  id: string;
  heading: string;
  markdown: string;
}

/**
 * The whole deliverable as one markdown string — what the copy button copies
 * and the download button writes. Sections with no body are omitted rather than
 * emitted as an empty heading, so a run stopped half way exports what it has.
 */
export function assembleDocument(title: string, sections: DocumentSection[]): string {
  const parts = [`# ${title}`, ''];
  for (const section of sections) {
    if (!section.markdown.trim()) continue;
    parts.push(`## ${section.heading}`, '', section.markdown.trim(), '');
  }
  return parts.join('\n').trimEnd() + '\n';
}

/** A filename that sorts by date and survives every filesystem. */
export function documentFilename(title: string, generatedAt = new Date()): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const date = generatedAt.toISOString().slice(0, 10);
  return `${slug || 'hai-deliverable'}-${date}.md`;
}
