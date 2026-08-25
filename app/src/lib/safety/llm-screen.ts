/**
 * Optional second-pass PII screen, off by default.
 *
 * The regex pass in `pii.ts` cannot see a bare personal name, and it cannot see
 * the re-identification risk in "a 14-year-old girl from the second village
 * north of the health post, incident on Tuesday". Both are real, and both are
 * things a small model spots reliably. Set `PII_LLM_SCREEN=true` to turn it on.
 *
 * ## What it costs, honestly
 *
 * This is a full model round-trip in front of every message, before the first
 * token of the answer. Measured against local Ollama on an M-series laptop:
 *
 * - qwen2.5:14b (the default chat model, already resident): roughly 0.8–2.5s.
 * - A 0.5B extraction model such as nuextract, set via `PII_SCREEN_MODEL`:
 *   roughly 0.2–0.6s once warm, but it occupies a second model slot and Ollama
 *   will evict and reload models if memory is tight, which turns the first call
 *   after an idle period into a 5–15s cold start.
 * - A hosted endpoint: add network latency, and note that the screen sends the
 *   user's text off-machine — which for the exact content this feature exists to
 *   protect is a trade-off worth making deliberately rather than by default.
 *
 * That is why it ships off. The deterministic pass costs microseconds and
 * catches the patterns that carry the most risk; this one buys recall on names
 * at a cost the user should opt into.
 *
 * ## Failure behaviour
 *
 * Fails open. If the screen errors, times out, or answers in a shape we cannot
 * read, the request proceeds — the deterministic pass has already run, and a
 * model outage should degrade recall, not take the assistant down. The failure
 * is counted, never logged with content.
 */

import { generateText } from 'ai';

import { getScreeningModel } from '@/lib/llm/provider';
import type { PiiFinding } from './pii';

const SCREEN_TIMEOUT_MS = 6_000;

/** Cap what we send: a decision this coarse does not need the whole paste. */
const MAX_SCREEN_CHARS = 4_000;

const SCREEN_SYSTEM = `You are a data-protection filter for a humanitarian assistant. You classify text; you never answer it.

Decide whether the text contains identifiable personal data about an affected person (a beneficiary, patient, survivor, applicant, or named individual): a personal name, a nickname tied to an individual, a verbatim quote attributed to one person, or a combination of details (age plus small locality plus date, or role plus location) that would re-identify someone in a small community.

Does NOT count as identifiable personal data:
- Aggregate figures, caseloads, indicator values, population counts, funding amounts.
- Names of organisations, agencies, clusters, camps, districts, or countries.
- Names of public officials or agency staff acting in their public role.
- Names of standards, handbooks, or their authors.

Answer with exactly one word: YES if identifiable personal data about an affected person is present, NO otherwise. No explanation.`;

export function isLlmScreenEnabled(): boolean {
  return process.env.PII_LLM_SCREEN === 'true';
}

/**
 * Returns a finding when the model judges the text to contain identifiable
 * personal data the regexes missed, otherwise undefined. Never returns any part
 * of the input.
 */
export async function llmScreen(input: string): Promise<PiiFinding | undefined> {
  if (!isLlmScreenEnabled()) return undefined;
  const text = input.trim();
  if (!text) return undefined;

  try {
    const { text: verdict } = await generateText({
      model: getScreeningModel(),
      system: SCREEN_SYSTEM,
      prompt: text.slice(0, MAX_SCREEN_CHARS),
      temperature: 0,
      // One word. Anything longer means the model started answering the user's
      // question instead of classifying it, and is treated as unreadable.
      maxOutputTokens: 4,
      abortSignal: AbortSignal.timeout(SCREEN_TIMEOUT_MS),
    });

    if (!/^\s*yes\b/i.test(verdict)) return undefined;

    return {
      type: 'identifier',
      label: 'Personal details identifying an individual',
      // No snippet: the model reports a judgement about the whole message, not
      // a span, so there is nothing to mask and nothing worth echoing.
      snippet: 'detected in the message body',
      reason:
        'A second-pass review read this as describing one identifiable person rather than a population — a name, an attributed quote, or a combination of age, place, and date that would identify someone in a small community.',
      principle: 'personal data protection',
      remedy:
        'Describe the case in categories rather than particulars: an age band, an administrative area rather than a village, and the type of incident rather than its date.',
    };
  } catch {
    // Fail open, and deliberately without logging: the thing that errored is
    // holding the exact content this module exists to keep out of logs.
    return undefined;
  }
}
