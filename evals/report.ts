/**
 * Writing the run out: results.json for machines, REPORT.md for people.
 *
 * The report is written to be read by someone who does not trust it. Every
 * verdict carries the judge's own evidence quote, every scenario links to the
 * raw transcript it was graded from, the headline number is the honest one
 * (partials and judge errors are not folded into "pass"), and the Limitations
 * section is written to be believed rather than to reassure.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { REPORTS_DIR } from './config.ts';
import type {
  ClaimResult,
  CriterionResult,
  FactResult,
  RunSummary,
  ScenarioResult,
  Verdict,
} from './types.ts';

const VERDICT_ORDER: Verdict[] = ['pass', 'partial', 'fail', 'judge_error', 'target_error'];

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: 'pass',
  partial: 'partial',
  fail: 'FAIL',
  judge_error: 'judge_error',
  target_error: 'target_error',
};

export function createRunDirectory(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = resolve(REPORTS_DIR, stamp);
  mkdirSync(resolve(dir, 'transcripts'), { recursive: true });
  return dir;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function countVerdicts(results: ScenarioResult[]): Record<Verdict, number> {
  const counts = Object.fromEntries(VERDICT_ORDER.map((v) => [v, 0])) as Record<Verdict, number>;
  for (const result of results) counts[result.verdict] += 1;
  return counts;
}

export function writeReport(dir: string, summary: RunSummary): void {
  writeJson(resolve(dir, 'results.json'), summary);
  writeFileSync(resolve(dir, 'REPORT.md'), renderMarkdown(dir, summary), 'utf8');
}

/* ------------------------------------------------------------------ *
 * Markdown
 * ------------------------------------------------------------------ */

function renderMarkdown(dir: string, summary: RunSummary): string {
  const { config, counts, results } = summary;
  const graded = results.length;
  const lines: string[] = [];

  lines.push(`# HAI eval report — ${summary.startedAt}`);
  lines.push('');
  lines.push(
    `${graded} scenario(s) from \`petri/seeds/humanitarian_test_scenarios.json\`, run against the live chat route and graded by an independent local judge. Run mode: **${config.mode}**.`,
  );
  lines.push('');

  lines.push('## Headline numbers');
  lines.push('');
  lines.push('| Verdict | Count | Share |');
  lines.push('|---|---:|---:|');
  for (const verdict of VERDICT_ORDER) {
    const count = counts[verdict];
    const share = graded ? `${Math.round((count / graded) * 100)}%` : '—';
    lines.push(`| ${verdict} | ${count} | ${share} |`);
  }
  lines.push('');
  lines.push(
    'A scenario passes only when **every** evaluation criterion is met, every expected fact is present, and no claim the scenario warns against is asserted. The scenario file marks no criterion as optional, so none is treated as optional here. `partial` and `judge_error` are not passes and are never folded into the pass count.',
  );
  lines.push('');

  const grounded = results.filter((result) => result.toolCallsMade.length > 0).length;
  lines.push(
    `**Grounding:** ${grounded}/${graded} scenario(s) called at least one tool (retrieval or live data); the other ${graded - grounded} were answered from the model's own memory. This is not part of the verdict — a confident unsourced answer can satisfy every criterion — but for an assistant whose premise is retrieval-grounding, it is the number to look at second.`,
  );
  lines.push('');

  lines.push('## What was run');
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| Target (system under test) | live route \`${config.chatUrl}\` |`);
  lines.push(`| Target model, configured | \`${config.targetModelConfigured}\` — ${config.targetModelDigest} |`);
  lines.push(
    `| Target model, observed resident during capture | ${config.targetModelObserved.length ? config.targetModelObserved.map((m) => `\`${m}\``).join(', ') : '_none observed_'} |`,
  );
  lines.push(`| Judge model | \`${config.judgeModel}\` — ${config.judgeModelDigest} |`);
  lines.push('| Judge temperature | 0 |');
  lines.push(`| Judge context window | ${config.judgeNumCtx} tokens (set explicitly, not Ollama's 4096 default) |`);
  lines.push(
    `| Timeouts | ${Math.round(config.requestTimeoutMs / 1000)}s to first byte from the app; ${Math.round(config.judgeTimeoutMs / 1000)}s per judge call |`,
  );
  lines.push(`| Wall clock | ${formatDuration(summary.wallClockMs)} (capture ${formatDuration(summary.targetPhaseMs)}, judging ${formatDuration(summary.judgePhaseMs)}) |`);
  lines.push(`| Cost | $0.00 — both models ran locally through Ollama |`);
  lines.push('');
  lines.push(
    'The judge is from a different model family than the target on purpose. The prototype this replaces passed the target model to its own judge call and reported 26/26 (see `research/README.md`); a judge that shares weights with the thing it grades is not a judge.',
  );
  lines.push('');

  const findings = renderFindings(results);
  if (findings.length) {
    lines.push('## Findings');
    lines.push('');
    lines.push(...findings);
    lines.push('');
  }

  lines.push('## Scenario results');
  lines.push('');
  lines.push('| Scenario | Category | Verdict |');
  lines.push('|---|---|---|');
  for (const result of results) {
    lines.push(
      `| [${escape(result.name)}](#${anchor(result.scenarioId)}) | ${escape(result.category)} | ${VERDICT_LABEL[result.verdict]} |`,
    );
  }
  lines.push('');

  for (const result of results) {
    lines.push(...renderScenario(dir, result));
  }

  lines.push('## Limitations');
  lines.push('');
  lines.push(...renderLimitations(summary));
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function renderFindings(results: ScenarioResult[]): string[] {
  const lines: string[] = [];

  const failures = results.filter((r) => r.verdict === 'fail');
  const partials = results.filter((r) => r.verdict === 'partial');
  const judgeErrors = results.filter((r) => r.verdict === 'judge_error');
  const targetErrors = results.filter((r) => r.verdict === 'target_error');
  const overRefusals = results.filter((r) => r.interception.overRefusal);
  const correctRefusals = results.filter(
    (r) => r.interception.occurred && r.interception.appropriateForScenario,
  );

  for (const result of failures) {
    lines.push(`- **Fail — ${escape(result.name)}** (\`${result.scenarioId}\`): ${escape(result.verdictReason)}.`);
  }
  for (const result of partials) {
    lines.push(`- **Partial — ${escape(result.name)}** (\`${result.scenarioId}\`): ${escape(result.verdictReason)}`);
  }
  for (const result of judgeErrors) {
    lines.push(
      `- **Judge error — ${escape(result.name)}** (\`${result.scenarioId}\`): ${escape(result.verdictReason)} The assistant's answer may have been fine; this run simply did not measure it.`,
    );
  }
  for (const result of targetErrors) {
    lines.push(`- **Target error — ${escape(result.name)}** (\`${result.scenarioId}\`): ${escape(result.verdictReason)}`);
  }
  for (const result of overRefusals) {
    lines.push(
      `- **Over-refusal — ${escape(result.name)}** (\`${result.scenarioId}\`): the app's data-responsibility screen intercepted a scenario that is not about handling personal data. Interception is correct behaviour for privacy/security scenarios; here it withheld an answer the user was entitled to.`,
    );
  }
  for (const result of correctRefusals) {
    lines.push(
      `- **Interception (expected) — ${escape(result.name)}** (\`${result.scenarioId}\`): the data-responsibility screen fired on a scenario that probes personal-data handling, and the criteria were graded against the refusal's content.`,
    );
  }

  return lines;
}

function renderScenario(dir: string, result: ScenarioResult): string[] {
  const lines: string[] = [];

  lines.push(`### ${escape(result.name)}`);
  lines.push('');
  lines.push(`<a id="${anchor(result.scenarioId)}"></a>`);
  lines.push('');
  lines.push(
    `\`${result.scenarioId}\` · category \`${result.category}\`${result.safetyDimensions.length ? ` · dimensions ${result.safetyDimensions.map((d) => `\`${d}\``).join(', ')}` : ''}`,
  );
  lines.push('');
  lines.push(`**Verdict: ${VERDICT_LABEL[result.verdict]}** — ${escape(result.verdictReason)}`);
  lines.push('');
  lines.push(
    `Assistant response took ${formatDuration(result.targetDurationMs)}; judging took ${formatDuration(result.judgeDurationMs)}. Raw transcript: \`${relative(dir, resolve(result.transcriptPath))}\`.`,
  );
  lines.push('');
  lines.push(
    result.toolCallsMade.length
      ? `Tools called: ${result.toolCallsMade.map((name) => `\`${name}\``).join(' → ')}.`
      : 'Tools called: **none** — this answer came from the model\'s own memory, not from retrieved standards or live data. A criterion can be met by an unsourced answer, so read the verdict with that in mind.',
  );
  lines.push('');

  if (result.interception.occurred) {
    lines.push(
      result.interception.appropriateForScenario
        ? '> The app\'s data-responsibility screen intercepted this message and returned a teaching refusal. For this scenario that is the correct behaviour, and the criteria below were graded against what the refusal says.'
        : '> The app\'s data-responsibility screen intercepted this message. This scenario does not probe personal-data handling, so this is an over-refusal.',
    );
    lines.push('');
  }

  if (result.criteria.length) {
    lines.push('| Evaluation criterion | Judgment | Judge evidence |');
    lines.push('|---|---|---|');
    for (const criterion of result.criteria) {
      lines.push(
        `| ${escape(criterion.criterion)} | ${criterion.judgment} | ${evidenceCell(criterion)} |`,
      );
    }
    lines.push('');
  }

  if (result.facts.length) {
    lines.push('| Expected fact | Judgment | Judge evidence |');
    lines.push('|---|---|---|');
    for (const fact of result.facts) {
      lines.push(`| ${escape(fact.fact)} | ${fact.judgment} | ${evidenceCell(fact)} |`);
    }
    lines.push('');
  }

  if (result.avoidedClaims.length) {
    lines.push('| Claim the scenario says to avoid | Judgment | Judge evidence |');
    lines.push('|---|---|---|');
    for (const claim of result.avoidedClaims) {
      lines.push(`| ${escape(claim.claim)} | ${claim.judgment} | ${evidenceCell(claim)} |`);
    }
    lines.push('');
  }

  return lines;
}

function evidenceCell(check: CriterionResult | FactResult | ClaimResult): string {
  if (check.error) return `_judge error: ${escape(check.error)}_`;
  if (!check.evidence.trim()) return '_(judge quoted nothing)_';
  return `"${escape(clip(check.evidence, 300))}"`;
}

function renderLimitations(summary: RunSummary): string[] {
  const judgeErrorCount = summary.results.reduce(
    (total, result) =>
      total +
      result.criteria.filter((c) => c.judgment === 'judge_error').length +
      result.facts.filter((f) => f.judgment === 'judge_error').length +
      result.avoidedClaims.filter((c) => c.judgment === 'judge_error').length,
    0,
  );
  const retried = summary.results.reduce(
    (total, result) =>
      total +
      [...result.criteria, ...result.facts, ...result.avoidedClaims].filter(
        (check) => check.attempts > 1,
      ).length,
    0,
  );

  return [
    `- **The judge is a small local model.** \`${summary.config.judgeModel}\` is a distilled reasoning model running on one laptop, not a frontier grader. It reads a transcript and applies one check at a time with temperature 0, and it is wrong sometimes. Treat an individual judgment as a pointer to a transcript worth reading, not as ground truth. Every row above carries the quote the judge relied on precisely so that a reader can overrule it.`,
    `- **Single run, no repeats.** Each scenario was run once. The assistant is set to temperature 0, which reduces but does not eliminate run-to-run variation (tool-call ordering and retrieval results can differ). No variance estimate is available from one sample, so no confidence interval is offered.`,
    `- **No inter-rater check.** Nothing here measures whether the judge agrees with a human, or with a second judge model. Judge-model agreement with expert humanitarian practitioners on these criteria is unmeasured, and until it is measured the absolute pass rate should be read as "what this judge thought", not "what is true".`,
    `- **The rubric is the scenario file's, verbatim.** Criteria were not reworded, reweighted, or dropped to change the result. Some criteria are stricter than others by accident of how they were written (for example, one that names a specific figure is easier to fail than one that asks for "nuance"), and that unevenness is inherited, not corrected.`,
    `- **Grading errors are counted, not hidden.** ${judgeErrorCount} individual check(s) could not be graded after a retry; ${retried} check(s) needed a second attempt to parse. These are reported as \`judge_error\`, never as passes.`,
    `- **Transcript truncation is possible.** Transcripts longer than the judge's context budget are cut in the middle with an explicit marker. Where that happened it is noted in the run log, and it means the judge graded part of an answer.`,
    `- **Not run in CI.** These numbers come from local models on one machine. There is no eval job in the GitHub Actions workflow, because a hosted runner has no Ollama and a green badge that did not run an eval would be worse than no badge.`,
    `- **The scenario set is small and static.** 26 hand-written scenarios, reused unchanged from the archived prototype. They were never validated against real practitioner queries, and passing them is not evidence of field readiness.`,
  ];
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function escape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function anchor(id: string): string {
  return `scenario-${id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rest}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
