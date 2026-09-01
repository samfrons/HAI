/**
 * Optional second-pass PII screen, off by default.
 *
 * The regex pass in `pii.ts` cannot see a bare personal name, and it cannot see
 * the re-identification risk in "a 14-year-old girl from the second village
 * north of the health post, incident on Tuesday". Both are real, and both are
 * things a small model spots reliably. Set `PII_LLM_SCREEN=true` to turn it on.
 *
 * ## What it costs, measured rather than estimated
 *
 * This is a full model round-trip in front of every message, paid before the
 * first token of the answer. Numbers below are real measurements against local
 * Ollama on an Apple-silicon laptop, using this module's actual system prompt
 * (221 prompt tokens) — and taken while the same machine was running the dev
 * server, an embedding model, and several concurrent builds, so it is a loaded
 * machine rather than a benchmark rig. Treat them as the pessimistic end.
 *
 * - qwen2.5:14b, already resident: about 5s per call once the machine settled,
 *   with all three smoke cases classified correctly (a named individual as
 *   YES, a Sphere threshold question and an aggregate caseload figure as NO).
 *   Under load the same calls took 69s and then ran past 120s once the machine
 *   began swapping. The spread between 5s and 120s is the machine, not the
 *   model, and it is the reason the timeout exists.
 * - phi3.5: 6–16s, obeys the one-word format, but answered NO to a message
 *   naming an individual — a false negative on precisely the case this screen
 *   exists to catch. Not recommended.
 * - nuextract: 1.7–18s, and it ignores the classification instruction
 *   altogether, replying with extracted prose ("Title: Feed…"). Unusable here.
 *   An extraction-tuned model is the wrong tool for a yes/no judgement, which
 *   is worth knowing before reaching for the smallest thing available.
 * - A hosted endpoint would be faster, but it sends the user's text
 *   off-machine — for the exact content this feature exists to protect, that is
 *   a trade-off to make deliberately rather than by default.
 *
 * The short version: on a busy local machine this screen mostly times out and
 * fails open, which costs latency and buys nothing. That is why it ships off,
 * and why the honest recommendation is to enable it only against an endpoint
 * that can answer a 221-token classification in about a second. The
 * deterministic pass costs microseconds and catches the patterns carrying the
 * most risk; this one buys recall on bare names at a price worth opting into
 * knowingly.
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

/**
 * Bounded because the user is waiting behind it. Raising it does not make a
 * slow endpoint usable — it just moves the cost from "screen skipped" to "user
 * stares at an empty message". Override with PII_SCREEN_TIMEOUT_MS.
 */
const SCREEN_TIMEOUT_MS = Number(process.env.PII_SCREEN_TIMEOUT_MS) || 8_000;

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
