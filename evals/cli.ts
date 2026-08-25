/**
 * `pnpm eval --smoke`  — three scenarios (~40 minutes on a loaded machine)
 * `pnpm eval`          — all 26, sequential (hours)
 * `pnpm eval --only=deception_test_001,acled_accuracy_001`
 *
 * The run is two phases, not one loop per scenario: every assistant response is
 * captured first, then every judgment is made. That is not cosmetic. The target
 * (~9GB) and the judge (~5GB) are both Ollama models on one machine;
 * interleaving them evicts and reloads weights on every scenario, which on a
 * loaded laptop costs minutes per swap. Two phases pay the load twice.
 *
 * Everything is written to disk as it completes — transcripts during capture,
 * results.json and REPORT.md after each scenario is judged — so an interrupted
 * run keeps everything it had already measured.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CHAT_URL,
  JUDGE_MODEL,
  JUDGE_NUM_CTX,
  OLLAMA_BASE_URL,
  REQUEST_TIMEOUT_MS,
  readConfiguredTargetModel,
} from './config.ts';
import { judgeScenario } from './judge.ts';
import { describeModel, loadedModels } from './models.ts';
import {
  countVerdicts,
  createRunDirectory,
  formatDuration,
  writeJson,
  writeReport,
} from './report.ts';
import { runScenario } from './runner.ts';
import { loadScenarios, selectScenarios } from './scenarios.ts';
import type { RunConfig, RunSummary, Scenario, ScenarioResult, Transcript } from './types.ts';

interface Options {
  smoke: boolean;
  only: string[];
  resume: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { smoke: false, only: [], resume: '' };
  for (const arg of argv) {
    if (arg === '--smoke') options.smoke = true;
    else if (arg.startsWith('--only=')) {
      options.only = arg
        .slice('--only='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--resume=')) {
      options.resume = resolve(arg.slice('--resume='.length));
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: pnpm eval [--smoke] [--only=id1,id2] [--resume=reports/<timestamp>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function log(message = ''): void {
  console.log(message);
}

/** A previously captured transcript, or null if there isn't a usable one. */
function readTranscript(path: string): Transcript | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Transcript;
  } catch {
    return null;
  }
}

/** Fails fast and specifically, rather than producing a report of timeouts. */
async function preflight(): Promise<void> {
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
      signal: AbortSignal.timeout(30_000),
    });
    // An empty message list is rejected with 400 by the route — which is proof
    // the route is up and reachable, and costs no inference.
    if (response.status >= 500) {
      throw new Error(`chat route returned HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Cannot reach the chat route at ${CHAT_URL} (${error instanceof Error ? error.message : String(error)}). Start it with \`pnpm dev\` in app/.`,
    );
  }

  const tags = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!tags?.ok) {
    throw new Error(`Cannot reach Ollama at ${OLLAMA_BASE_URL}. Is \`ollama serve\` running?`);
  }

  const body = (await tags.json()) as { models?: Array<{ name?: string }> };
  const available = (body.models ?? []).map((model) => model.name);
  if (!available.includes(JUDGE_MODEL)) {
    throw new Error(
      `Judge model ${JUDGE_MODEL} is not pulled. Run \`ollama pull ${JUDGE_MODEL}\`. Available: ${available.join(', ')}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date();

  await preflight();

  const scenarios = selectScenarios(loadScenarios(), options);
  const mode: RunConfig['mode'] = options.only.length ? 'custom' : options.smoke ? 'smoke' : 'full';

  const dir = options.resume || createRunDirectory();
  log(`HAI eval — ${mode} run, ${scenarios.length} scenario(s)`);
  if (options.resume) log(`Resuming into ${dir} — transcripts already on disk will be reused.`);
  log(`Target: ${CHAT_URL}`);
  log(`Judge:  ${JUDGE_MODEL} @ ${OLLAMA_BASE_URL} (temperature 0, num_ctx ${JUDGE_NUM_CTX})`);
  log(`Output: ${dir}`);
  log();

  /* ---------------- Phase 1: capture ---------------- */

  log(`Phase 1/2 — capturing ${scenarios.length} assistant response(s) from the live route.`);
  const capturePhaseStart = Date.now();
  const captured: Array<{ scenario: Scenario; transcript: Transcript; path: string }> = [];
  let observedModels: string[] = [];

  for (const [index, scenario] of scenarios.entries()) {
    const label = `[${index + 1}/${scenarios.length}] ${scenario.id}`;
    const path = resolve(dir, 'transcripts', `${scenario.id}.json`);

    // Capturing a transcript costs minutes of local inference, and a run can
    // die for reasons that have nothing to do with the assistant — the dev
    // server restarting underneath it, for one. A transcript already on disk
    // is a completed measurement, so --resume reuses it rather than paying
    // for it twice.
    const existing = options.resume ? readTranscript(path) : null;
    if (existing) {
      captured.push({ scenario, transcript: existing, path });
      log(`  ${label} — reusing transcript captured at ${existing.startedAt}`);
      continue;
    }

    log(`  ${label} — sending probe…`);

    const transcript = await runScenario(scenario);
    writeJson(path, transcript);
    captured.push({ scenario, transcript, path });

    if (!observedModels.length) observedModels = await loadedModels();

    const notes = [
      formatDuration(transcript.durationMs),
      `${transcript.turns.reduce((total, turn) => total + turn.toolCalls.length, 0)} tool call(s)`,
      `${transcript.turns.reduce((total, turn) => total + turn.text.length, 0)} chars`,
    ];
    if (transcript.interceptionOccurred) {
      notes.push(
        transcript.interceptionIsAppropriate
          ? 'INTERCEPTED (expected for this scenario)'
          : 'INTERCEPTED (over-refusal for this scenario)',
      );
    }
    if (transcript.failed) notes.push(`FAILED: ${transcript.errors.join('; ') || 'empty response'}`);
    log(`  ${label} — ${notes.join(', ')}`);
  }

  const targetPhaseMs = Date.now() - capturePhaseStart;
  log(`Phase 1/2 done in ${formatDuration(targetPhaseMs)}.`);
  log();

  /* ---------------- Phase 2: judge ---------------- */

  const totalChecks = scenarios.reduce(
    (total, scenario) =>
      total +
      scenario.evaluation_criteria.length +
      (scenario.expected_facts?.length ?? 0) +
      (scenario.incorrect_claims_to_avoid?.length ?? 0),
    0,
  );
  log(`Phase 2/2 — judging ${totalChecks} check(s) with ${JUDGE_MODEL}, one at a time.`);
  const judgePhaseStart = Date.now();

  const config: RunConfig = {
    chatUrl: CHAT_URL,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    judgeModel: JUDGE_MODEL,
    targetModelConfigured: readConfiguredTargetModel(),
    targetModelObserved: observedModels,
    judgeModelDigest: await describeModel(JUDGE_MODEL),
    targetModelDigest: await describeModel(observedModels[0] ?? ''),
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    judgeNumCtx: JUDGE_NUM_CTX,
    mode,
    scenarioIds: scenarios.map((scenario) => scenario.id),
  };

  const results: ScenarioResult[] = [];

  const flush = (): void => {
    const finishedAt = new Date();
    const summary: RunSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      wallClockMs: finishedAt.getTime() - startedAt.getTime(),
      targetPhaseMs,
      judgePhaseMs: Date.now() - judgePhaseStart,
      config,
      counts: countVerdicts(results),
      results,
    };
    writeReport(dir, summary);
  };

  // An interrupted run keeps what it measured; it does not pretend to be whole.
  process.on('SIGINT', () => {
    log('\nInterrupted — writing the partial report before exiting.');
    flush();
    log(`Partial report: ${resolve(dir, 'REPORT.md')} (${results.length}/${scenarios.length} scenarios judged)`);
    process.exit(130);
  });

  for (const [index, entry] of captured.entries()) {
    const label = `[${index + 1}/${captured.length}] ${entry.scenario.id}`;
    log(`  ${label} — judging…`);

    const result = await judgeScenario(entry.scenario, entry.transcript, entry.path, (message) =>
      log(message),
    );
    results.push(result);
    flush();

    log(`  ${label} — ${result.verdict.toUpperCase()}: ${result.verdictReason}`);
  }

  const judgePhaseMs = Date.now() - judgePhaseStart;
  flush();

  /* ---------------- Summary ---------------- */

  const counts = countVerdicts(results);
  log();
  log(`Phase 2/2 done in ${formatDuration(judgePhaseMs)}.`);
  log();
  log('Verdicts:');
  for (const [verdict, count] of Object.entries(counts)) {
    log(`  ${verdict.padEnd(13)} ${count}`);
  }
  log();
  log(`Report:  ${resolve(dir, 'REPORT.md')}`);
  log(`Results: ${resolve(dir, 'results.json')}`);
  log(`Total wall clock: ${formatDuration(Date.now() - startedAt.getTime())}`);
}

main().catch((error) => {
  console.error(`\neval failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
