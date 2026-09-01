/**
 * Turns PII findings into the reply the user actually sees.
 *
 * The refusal is the teaching moment, so it is written as one: it names the
 * pattern (masked), names the IASC principle that makes it a problem, and shows
 * the same question asked in a form the assistant can answer. A bare "I can't
 * help with that" teaches nothing and gets routed around — usually by pasting
 * the same data into a tool with no screening at all.
 *
 * Nothing in here reads or reproduces the flagged text. It works only from the
 * masked findings, which is what makes it safe to render, and safe to stream.
 */

import type { PiiFinding, PiiFindingType } from './pii';

export const RESPONSIBLE_USE_GUIDE = '/guides/responsible-use';

const IASC_GUIDANCE =
  'IASC Operational Guidance on Data Responsibility in Humanitarian Action';

export interface SafetyNoticeData {
  /** Masked pattern summaries, safe to render. */
  findings: Array<{ type: PiiFindingType; label: string; snippet: string }>;
  /** IASC principles engaged, named as the guidance names them. */
  principles: string[];
  guideHref: string;
}

export function buildSafetyNotice(findings: PiiFinding[]): SafetyNoticeData {
  return {
    findings: findings.map(({ type, label, snippet }) => ({ type, label, snippet })),
    principles: uniquePrinciples(findings),
    guideHref: RESPONSIBLE_USE_GUIDE,
  };
}

function uniquePrinciples(findings: PiiFinding[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const finding of findings) {
    if (seen.has(finding.principle)) continue;
    seen.add(finding.principle);
    ordered.push(finding.principle);
  }
  return ordered;
}

/**
 * A de-identified version of the kind of request each pattern usually belongs
 * to. Deliberately generic: the flagged text is never read back, so the example
 * cannot be a rewrite of what the user actually wrote.
 */
const REWRITE_EXAMPLES: Record<PiiFindingType, string> = {
  phone:
    'What is the standard referral pathway for a protection case identified during a distribution, and who holds the contact details at each step?',
  email:
    'Which role in a camp coordination structure should receive a protection referral, and what does the CHS require of that handover?',
  identifier:
    'What do the standards say about handling a case of this type — the criteria, the referral pathway, and the documentation the receiving agency needs?',
  coordinates:
    'What are the site-planning minimums for a settlement of this size at admin-2 level?',
  'date-of-birth':
    'What are the SAM admission and discharge criteria for children aged 6–59 months, and what changes for a 34-year-old adult caregiver?',
  'bulk-list':
    'I have a caseload of 240 households broken down by age band, sex, and block. What do the standards require for prioritising assistance across those groups?',
};

const REWRITE_PRIORITY: PiiFindingType[] = [
  'bulk-list',
  'identifier',
  'date-of-birth',
  'coordinates',
  'phone',
  'email',
];

function chooseRewrite(findings: PiiFinding[]): string {
  const present = new Set(findings.map((finding) => finding.type));
  const pick = REWRITE_PRIORITY.find((type) => present.has(type)) ?? 'identifier';
  return REWRITE_EXAMPLES[pick];
}

function formatPrinciples(principles: string[]): string {
  const bolded = principles.map((principle) => `**${principle}**`);
  if (bolded.length === 1) return bolded[0];
  if (bolded.length === 2) return `${bolded[0]} and ${bolded[1]}`;
  return `${bolded.slice(0, -1).join(', ')}, and ${bolded[bolded.length - 1]}`;
}

/**
 * The full refusal, as markdown. Streamed to the client as an ordinary
 * assistant message — an HTTP error would render as a red failure banner, which
 * frames a correct safety decision as a broken app.
 */
export function buildInterceptionMessage(findings: PiiFinding[]): string {
  const principles = uniquePrinciples(findings);
  const plural = findings.length > 1;

  const detected = findings
    .map(
      (finding) =>
        `- **${finding.label}** — \`${finding.snippet}\`\n  ${finding.reason}`,
    )
    .join('\n');

  const remedies = Array.from(new Set(findings.map((finding) => finding.remedy)))
    .map((remedy, index) => `${index + 1}. ${remedy}`)
    .join('\n');

  return [
    `I've stopped before answering this one. Your message contains ${
      plural ? 'patterns that read' : 'a pattern that reads'
    } as identifiable data about a specific person, and that is a line I hold regardless of what the underlying task was.`,
    '',
    `**What I detected**, shown masked — a screening layer that repeats what it caught has moved the exposure rather than prevented it. The flagged content has not been logged, stored, or sent to the model.`,
    '',
    detected,
    '',
    `**Why this stops here.** The *${IASC_GUIDANCE}* sets out principles you already work under, and ${
      principles.length > 1 ? 'these apply' : 'this one applies'
    } directly here: ${formatPrinciples(principles)}. They bite at the point of entry, not the point of storage — the exposure happens when the data is pasted, whatever happens to the output afterwards.`,
    '',
    `This is a near-miss, not a lapse. Pasting a case detail into an assistant to save an hour on a report does not feel like a data transfer in the moment, which is precisely why it is the failure mode worth catching.`,
    '',
    '**How to ask this so I can help.**',
    '',
    remedies,
    '',
    '**The same question, in a form I can answer:**',
    '',
    `> ${chooseRewrite(findings)}`,
    '',
    `The test that catches most of these before they happen: if you would not paste it into a public Slack channel, it does not go into an AI chat. Aggregate first, de-identify first, or keep that specific task inside the system that already holds the data under its own access controls.`,
  ].join('\n');
}
