/**
 * The vocabulary of HAI's agentic workflows: what a deliverable is made of,
 * and what the machine says about itself while it makes one.
 *
 * Two ideas live here and nothing else, so both the server engine and the
 * client trace panel can import them without dragging the AI SDK into the
 * browser bundle:
 *
 * 1. `WorkflowDefinition` — a deliverable expressed as an ordered list of
 *    bounded model calls. Not a free-running agent loop: every step names its
 *    own prompt and its own allowed tools, and the sequence is fixed in advance
 *    by a template. That is deliberate. A loop that decides its own next move
 *    is impossible to show honestly to a reader and impossible to keep inside a
 *    token budget; a declared sequence is both.
 *
 * 2. `TraceEvent` — the record of what actually happened. Every claim the
 *    finished document makes should be traceable back to an event in this
 *    stream, which is the whole point: a humanitarian brief that cannot be
 *    audited is not usable, however well written.
 */

/* ------------------------------------------------------------------ *
 * Workflow definition
 * ------------------------------------------------------------------ */

/**
 * What a step does. Each maps to a different shape of model call, and the
 * engine treats them differently — see `engine.ts`.
 *
 * - `plan`   resolves the subject (country name → ISO3, display name) and
 *            publishes the section checklist. One tiny structured call.
 * - `gather` runs a tool-calling loop with a named tool subset and turns what
 *            comes back into evidence. No prose is produced.
 * - `draft`  writes one section from the evidence gathered for it. No tools —
 *            a drafting step that can still call tools is a drafting step that
 *            will pad a thin section with a fresh search instead of admitting
 *            the gap.
 * - `verify` extracts the factual claims from a drafted section and checks each
 *            one against the evidence that step was given.
 */
export type StepKind = 'plan' | 'gather' | 'draft' | 'verify';

/** A verdict on one extracted claim. */
export type Verdict = 'supported' | 'unsupported' | 'unverifiable';

/** A section of the finished deliverable, as declared by the template. */
export interface SectionSpec {
  id: string;
  /** English heading. Rendered into the document itself, so it is not i18n chrome. */
  heading: string;
  /**
   * What this section must contain, in the second person, handed to the draft
   * step verbatim. Keep it to a few lines: it is re-sent on every draft call,
   * and the hosted deployment is metered by the minute.
   */
  brief: string;
  /**
   * Tool names this section's gather step may call, matched against the keys of
   * the `haiTools` registry. Names that are not registered are skipped rather
   * than erroring, so a tool added later flows in by being registered and a
   * tool removed does not break every template that mentioned it.
   */
  tools: readonly string[];
  /**
   * What to search for, as instructions to the gather step. Written in the
   * vocabulary of the standards and the datasets rather than the user's.
   */
  gatherBrief: string;
  /**
   * Sections that assemble from the run's own bookkeeping (sources, per-source
   * errors, timestamp) rather than from a model call. They still appear in the
   * plan and still tick through the trace; they just have no LLM step.
   */
  synthesised?: 'sources-and-caveats';
  /** Skip verification for a section that makes no factual claims of its own. */
  skipVerification?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  /** English title of the deliverable, used in the exported markdown. */
  title: string;
  /**
   * How the subject line is interpreted — a country for the situation brief, a
   * free-text programme topic for the donor report. Drives the plan step and
   * the document title.
   */
  subjectKind: 'country' | 'topic';
  /** One line describing the deliverable, shown on the template card. */
  description: string;
  sections: readonly SectionSpec[];
}

/* ------------------------------------------------------------------ *
 * Trace events
 * ------------------------------------------------------------------ */

/** A section as announced by the plan step, before any of it exists. */
export interface PlannedSection {
  id: string;
  heading: string;
}

/**
 * Everything the engine says about itself, in the order it happens.
 *
 * `at` is milliseconds since the epoch on the server. The client renders
 * durations from it rather than running its own timers, so what the reader sees
 * is when the work actually happened rather than when the bytes arrived.
 */
export type TraceEvent =
  | {
      type: 'plan-created';
      at: number;
      workflowId: string;
      /** Resolved display subject, e.g. "Sudan" for an input of "sudan". */
      subject: string;
      /** ISO3 where the subject resolved to a country, else undefined. */
      iso3?: string;
      sections: PlannedSection[];
    }
  | {
      type: 'step-started';
      at: number;
      stepId: string;
      kind: StepKind;
      /** English label; the client translates by `kind`, not by this string. */
      label: string;
      sectionId?: string;
    }
  | {
      type: 'step-finished';
      at: number;
      stepId: string;
      ok: boolean;
      /** Present when the step degraded — the reason, in one clause. */
      note?: string;
    }
  | {
      type: 'tool-called';
      at: number;
      stepId: string;
      callId: string;
      tool: string;
      /** Arguments flattened to one readable line — never the raw JSON blob. */
      args: string;
    }
  | {
      type: 'tool-result';
      at: number;
      stepId: string;
      callId: string;
      tool: string;
      ok: boolean;
      /** What came back, in one line: counts and source labels, not content. */
      summary: string;
    }
  | {
      /**
       * A slice of section prose as it is written. Separate from
       * `draft-section` so the document assembles in front of the reader
       * instead of appearing in finished blocks — the same reason chat streams.
       */
      type: 'draft-delta';
      at: number;
      sectionId: string;
      delta: string;
    }
  | {
      type: 'draft-section';
      at: number;
      sectionId: string;
      heading: string;
      /** The section as drafted, before verification annotates it. */
      markdown: string;
    }
  | {
      type: 'check-run';
      at: number;
      sectionId: string;
      claim: string;
      verdict: Verdict;
      /** The evidence label that supports the claim, when one does. */
      source?: string;
    }
  | {
      /**
       * The section after verification, with unsupported and unverifiable
       * claims marked in the prose. Replaces the `draft-section` body in the
       * document view. Always emitted for a verified section, even when every
       * claim held, so the client never has to guess whether checking finished.
       */
      type: 'section-verified';
      at: number;
      sectionId: string;
      markdown: string;
      flagged: number;
    }
  | {
      /**
       * A source that failed or reported no coverage. Collected rather than
       * thrown — a brief with five of six sources is worth having, provided it
       * says which one is missing. Ported from `situation.py`'s `errors` list.
       */
      type: 'source-error';
      at: number;
      source: string;
      message: string;
    }
  | {
      /**
       * The run is deliberately idle, waiting for the endpoint's token budget
       * to refill before the next step.
       *
       * This exists because the alternative is a lie by omission. Pacing means
       * a brief spends a large fraction of its wall clock doing nothing on
       * purpose, and a trace panel that simply stops updating for forty seconds
       * is indistinguishable from one that has crashed — which is what QA
       * reported on the live deployment. Naming the wait, with the time it will
       * take, turns the most alarming part of the run into the most legible.
       *
       * `scope` decides what the reader is told, and the two cases are not the
       * same news. A per-minute wait resolves itself; a per-day one does not,
       * and dressing it up as "resuming shortly" would leave someone watching a
       * counter that will still be there tomorrow.
       */
      type: 'budget-wait';
      at: number;
      /** Milliseconds from `at` until the run intends to continue. */
      waitMs: number;
      scope: 'tokens-per-minute' | 'tokens-per-day';
      /** The step the run is about to take, when it is waiting to take one. */
      stepId?: string;
    }
  | {
      /** The wait announced by the preceding `budget-wait` is over. */
      type: 'budget-resumed';
      at: number;
      stepId?: string;
    }
  | {
      type: 'workflow-done';
      at: number;
      /** ISO-8601 UTC, rendered into the document's own caveats section. */
      generatedAt: string;
      sections: number;
      flagged: number;
    }
  | {
      type: 'workflow-error';
      at: number;
      message: string;
    };

export type TraceEventType = TraceEvent['type'];

/** Narrowing helper for the client, which receives these as opaque data parts. */
export function isTraceEvent(value: unknown): value is TraceEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { at?: unknown }).at === 'number'
  );
}
