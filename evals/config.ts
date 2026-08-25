/**
 * Environment for the eval harness. Every default assumes "everything local":
 * the app on :3000 and Ollama on :11434.
 *
 * cost: $0.00 per run — the assistant and the judge both run on this machine.
 * Pointing HAI_CHAT_URL or EVAL_OLLAMA_URL at a hosted endpoint may bill per
 * token, and a full run makes hundreds of calls.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');
export const SCENARIOS_PATH = resolve(
  REPO_ROOT,
  'petri/seeds/humanitarian_test_scenarios.json',
);
export const REPORTS_DIR = resolve(HERE, 'reports');

export const CHAT_URL = process.env.HAI_CHAT_URL || 'http://localhost:3000/api/chat';
export const OLLAMA_BASE_URL = process.env.EVAL_OLLAMA_URL || 'http://localhost:11434';

/**
 * A different model family from the target on purpose. The whole point of the
 * rebuild is that the grader cannot share a failure mode with the graded model;
 * qwen judging qwen would reproduce the bug documented in research/README.md.
 */
export const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'deepseek-r1:latest';

/**
 * This machine runs both models on CPU/GPU under load, and a single judge call
 * has been observed taking 90s+ for twenty output tokens. Six minutes is not
 * generous, it is the floor at which a slow-but-working call stops being
 * misreported as a failure.
 *
 * For the chat route this bounds time-to-first-byte, not the whole answer —
 * see the stall and hard-cap budgets below.
 */
export const REQUEST_TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS || 360_000);

/**
 * A streaming answer needs two different guards, and conflating them produces
 * fake failures. Capping *total* stream duration punishes a healthy multi-step
 * answer — search, read, search again, write — that is simply slow because the
 * machine is loaded; the harness would record `target_error` and the report
 * would read as an assistant defect when it was a contention measurement.
 * What actually indicates a hung stream is silence: no new event for minutes.
 * So the stall budget is the real guard, and the hard cap only exists so a
 * pathological run cannot block a 26-scenario sweep forever.
 */
export const STREAM_STALL_MS = Number(process.env.EVAL_STALL_MS || 180_000);
export const TURN_BUDGET_MS = Number(process.env.EVAL_TURN_BUDGET_MS || 1_800_000);

/**
 * The judge gets its own, much larger budget, because it is not streaming and
 * because its first call on a cold cache is the slowest thing in a run. A
 * measured example on this machine: 887 prompt tokens and 15 output tokens took
 * 295 seconds, with a second ~9GB model resident and a load average near 30.
 *
 * This was originally sharing the 6-minute request timeout, and the result was
 * a `judge_error` on the first check of a run — a report that would have
 * claimed the judge was incoherent when it had in fact answered correctly and
 * merely answered slowly. A timeout that is too tight does not measure the
 * system under test; it measures the harness's patience.
 *
 * Later checks on the same transcript are faster: the system prompt and the
 * transcript are the shared prefix of every check for a scenario, so Ollama's
 * prompt cache carries most of the cost only once.
 */
export const JUDGE_TIMEOUT_MS = Number(process.env.EVAL_JUDGE_TIMEOUT_MS || 900_000);

/**
 * Ollama defaults to a 4096-token context. A transcript with two tool results
 * in it overflows that silently, and a judge reading a truncated transcript
 * marks real content "absent" — a wrong number that looks like a real one.
 * Set explicitly, and the transcript is truncated to fit with room to spare.
 */
export const JUDGE_NUM_CTX = Number(process.env.EVAL_JUDGE_NUM_CTX || 8192);

/** Character budgets that keep a rendered transcript inside JUDGE_NUM_CTX. */
export const MAX_TRANSCRIPT_CHARS = 12_000;
export const MAX_TOOL_RESULT_CHARS = 1_500;

/** Keeps the model resident between calls within a phase, so it loads once. */
export const KEEP_ALIVE = '15m';

/**
 * What the app is configured to run, read from its env file. This is what the
 * app says it uses, not proof of what served the request — the harness also
 * records Ollama's live /api/ps during the capture phase, which is the
 * observation. Both go in the report; where they disagree, believe /api/ps.
 */
export function readConfiguredTargetModel(): string {
  for (const file of ['app/.env.local', 'app/.env']) {
    try {
      const text = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      const match = text.match(/^\s*LLM_MODEL\s*=\s*(.+)$/m);
      if (match) return `${match[1].trim()} (from ${file})`;
    } catch {
      // Missing env file is normal; fall through to the provider default.
    }
  }
  return 'qwen2.5:14b (provider default, no LLM_MODEL found)';
}
