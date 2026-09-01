/**
 * The workflow engine: a declared sequence of bounded model calls that produces
 * a deliverable and a full account of how it was produced.
 *
 * # Why this is not an agent loop
 *
 * The obvious way to build "write me a situation brief" is one long
 * tool-calling turn with a big prompt and a high step cap. HAI cannot use that,
 * for three reasons that all point the same way.
 *
 * The first is the token budget. The deployed configuration talks to Groq's
 * free tier at 8,000 tokens per minute, and a single accumulating conversation
 * carries every tool result it has ever seen into every subsequent request. Six
 * sections of gathered evidence in one context window is a request that the
 * endpoint refuses outright — the same failure documented at length in
 * `lib/llm/provider.ts`, arriving faster. Sections that gather and draft
 * independently keep each request small: evidence for section four is never in
 * the request that writes section five.
 *
 * The second is honesty. A loop that chooses its own next move can be logged
 * but not planned, so the reader watching it has no idea what is left. A
 * declared section list can be shown as a checklist before any of it exists,
 * which is what makes the trace panel a progress indicator rather than a
 * scroll of noise.
 *
 * The third is verification, and it is the one that matters. Claims can only be
 * checked against the evidence that was actually retrieved for them. In one
 * long turn every claim is nominally checkable against everything, which in
 * practice means a figure gathered for the funding section can "support" a
 * sentence in the needs section. Per-section evidence makes the check strict:
 * this section's claims, against this section's sources, or it gets flagged.
 *
 * # What a run emits
 *
 * A `TraceEvent` stream, consumed by the route and forwarded to the client as
 * data parts. The generator never throws for anything a source did: a tool that
 * fails degrades its section and lands in the caveats. It throws only if the
 * model endpoint itself is unusable, and even then the last event out is a
 * `workflow-error` rather than a broken stream.
 */

import {
  generateText,
  stepCountIs,
  streamText,
  type LanguageModel,
  type ToolSet,
} from 'ai';

import { getChatModel, getProviderOptions } from '@/lib/llm/provider';
import { haiTools } from '@/lib/tools';

import {
  formatEvidence,
  harvest,
  summariseArgs,
  summariseResult,
  type EvidenceItem,
  type SourceError,
} from './evidence';
import {
  TokenPacer,
  estimateToolLoopTokens,
  estimateTokens,
  isRateLimitError,
  withRateLimitRetry,
} from './pacer';
import { renderSection, renderSourcesAndCaveats } from './render';
import type { SectionSpec, TraceEvent, WorkflowDefinition } from './types';
import { verifySection } from './verify';

/* ------------------------------------------------------------------ *
 * Step-scoped prompts
 * ------------------------------------------------------------------ */

/**
 * The policy every step carries, and all it carries.
 *
 * Note what is absent: this is not `SYSTEM_PROMPT`. The chat system prompt is
 * some 900 words of corpus description, principles, style, and refusal policy,
 * and it earns that length in a conversation where the model must decide for
 * itself what kind of question it has been asked. A workflow step has already
 * been told what to do by its own brief. Re-sending the full policy on all
 * eighteen calls of a situation brief would spend the better part of a minute's
 * token budget restating things the step cannot act on — so each step gets the
 * two rules it can violate (invent evidence, leak personal data) and its own
 * task, and nothing else.
 */
const STEP_POLICY = `You are a component of HAI, a humanitarian operations assistant. You are executing one step of a document-generation workflow, not holding a conversation.

Absolute rules:
- Use ONLY the evidence supplied to you. Never add a figure, date, standard, section number, or organisation name that is not in it. If the evidence does not cover something the section needs, write one sentence saying so and move on. A named gap is correct output; a plausible invented figure is the worst possible output.
- Never write identifiable personal data about affected people — no names, no case or registration numbers, no household-level detail, no precise individual locations. Report in aggregate only.
- Do not narrate yourself. No "let me", no "I will now", no apologies, no meta-commentary about the workflow.`;

/**
 * Max tool-calling steps allowed inside one gather.
 *
 * Two, lowered from three after the first live Sudan brief, and the reason is
 * the token budget rather than the search quality. A gather's cost is dominated
 * by results accumulating across its own steps (see `estimateToolLoopTokens`),
 * so a third step costs roughly what the first two did together — and at three
 * steps one section's gather reserves over 80% of a minute's ceiling, leaving
 * the draft and verify calls that follow it to wait out most of the next
 * minute.
 *
 * What that third step actually bought on the live run was mostly re-queries:
 * `crisis_updates` asked about Sudan three times with different words and got
 * the same empty answer. The useful fan-out — population, needs, and food
 * security together — happened inside a single step, because the model issues
 * several calls at once when the provider allows it. Two steps keep that and
 * drop the retry.
 */
const GATHER_STEP_CAP = 2;
/** Guard on section length — a brief is scanned under time pressure. */
const DRAFT_MAX_WORDS = 200;

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */

export interface WorkflowRunInput {
  workflow: WorkflowDefinition;
  /** The user's country or topic line. Already PII-screened by the route. */
  subject: string;
  signal?: AbortSignal;
}

export interface EngineDeps {
  model?: LanguageModel;
  /**
   * The tool registry. Defaults to `haiTools` and is injected only by tests —
   * templates name tools by string and the engine resolves them here, so a tool
   * added to the registry becomes available to every template that names it
   * without this file changing.
   */
  tools?: ToolSet;
  pacer?: TokenPacer;
  now?: () => number;
}

interface RunState {
  subject: string;
  iso3?: string;
  evidence: EvidenceItem[];
  sourceErrors: SourceError[];
  sectionMarkdown: Map<string, string>;
  flagged: number;
  evidenceCounter: number;
}

export async function* runWorkflow(
  input: WorkflowRunInput,
  deps: EngineDeps = {},
): AsyncGenerator<TraceEvent> {
  const model = deps.model ?? getChatModel();
  const registry = deps.tools ?? (haiTools as unknown as ToolSet);
  const pacer = deps.pacer ?? new TokenPacer();
  const now = deps.now ?? Date.now;
  const { workflow, subject, signal } = input;

  const state: RunState = {
    subject: subject.trim(),
    evidence: [],
    sourceErrors: [],
    sectionMarkdown: new Map(),
    flagged: 0,
    evidenceCounter: 0,
  };

  const nextEvidenceId = () => `e${++state.evidenceCounter}`;

  try {
    /* -------------------------------------------------------------- *
     * Plan
     * -------------------------------------------------------------- */
    const planStepId = 'plan';
    yield {
      type: 'step-started',
      at: now(),
      stepId: planStepId,
      kind: 'plan',
      label: 'Resolve subject and plan sections',
    };

    if (workflow.subjectKind === 'country') {
      const resolved = await resolveCountry(state.subject, { model, pacer, signal });
      state.subject = resolved.display;
      state.iso3 = resolved.iso3;
      if (!resolved.iso3) {
        // Not fatal. The country-scoped tools take an ISO3 and the gather steps
        // pass the name through as well, so the model can still resolve it at
        // call time — but the reader should know the run started uncertain.
        state.sourceErrors.push({
          source: 'subject',
          message: `Could not resolve "${state.subject}" to an ISO 3166-1 alpha-3 country code; country-scoped datasets may return nothing.`,
        });
        yield {
          type: 'source-error',
          at: now(),
          source: 'subject',
          message: `Could not resolve "${state.subject}" to an ISO3 country code.`,
        };
      }
    }

    yield {
      type: 'plan-created',
      at: now(),
      workflowId: workflow.id,
      subject: state.subject,
      iso3: state.iso3,
      sections: workflow.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
      })),
    };
    yield { type: 'step-finished', at: now(), stepId: planStepId, ok: true };

    /* -------------------------------------------------------------- *
     * Sections
     * -------------------------------------------------------------- */
    for (const section of workflow.sections) {
      throwIfAborted(signal);

      if (section.synthesised === 'sources-and-caveats') {
        // Assembled from the run's own bookkeeping rather than from the model:
        // which sources answered, which failed, and when this was generated.
        // Writing it with an LLM would be both a waste of budget and a way to
        // get the error list paraphrased into something less true.
        const markdown = renderSourcesAndCaveats({
          evidence: state.evidence,
          errors: state.sourceErrors,
          generatedAt: new Date(now()).toISOString(),
          flagged: state.flagged,
        });
        state.sectionMarkdown.set(section.id, markdown);
        yield {
          type: 'step-started',
          at: now(),
          stepId: `${section.id}:assemble`,
          kind: 'draft',
          label: `Assemble ${section.heading}`,
          sectionId: section.id,
        };
        yield { type: 'draft-delta', at: now(), sectionId: section.id, delta: markdown };
        yield {
          type: 'draft-section',
          at: now(),
          sectionId: section.id,
          heading: section.heading,
          markdown,
        };
        yield {
          type: 'step-finished',
          at: now(),
          stepId: `${section.id}:assemble`,
          ok: true,
        };
        continue;
      }

      /* ---- gather ---- */
      const gatherId = `${section.id}:gather`;
      yield {
        type: 'step-started',
        at: now(),
        stepId: gatherId,
        kind: 'gather',
        label: `Gather evidence — ${section.heading}`,
        sectionId: section.id,
      };

      const sectionEvidence: EvidenceItem[] = [];
      const activeTools = selectTools(registry, section.tools);

      if (activeTools.names.length === 0) {
        const message = `No registered tool matches ${section.tools.join(', ')}.`;
        state.sourceErrors.push({ source: section.id, message });
        yield { type: 'source-error', at: now(), source: section.id, message };
        yield { type: 'step-finished', at: now(), stepId: gatherId, ok: false, note: message };
      } else {
        let gatherNote: string | undefined;
        let calls = 0;

        try {
          for await (const event of gather({
            model,
            pacer,
            signal,
            stepId: gatherId,
            tools: activeTools.set,
            prompt: gatherPrompt(workflow, section, state),
            now,
            onHarvest: (tool, output) => {
              const result = harvest(tool, output, nextEvidenceId);
              sectionEvidence.push(...result.items);
              state.evidence.push(...result.items);
              state.sourceErrors.push(...result.errors);
              return result;
            },
          })) {
            if (event.type === 'tool-called') calls += 1;
            yield event;
          }
        } catch (error) {
          // A gather that fails outright is one degraded section, not a dead
          // run — the draft step below will write what the absence of evidence
          // permits, which is a sentence saying the sources were unreachable.
          gatherNote = errorMessage(error);
          state.sourceErrors.push({ source: section.id, message: gatherNote });
          yield { type: 'source-error', at: now(), source: section.id, message: gatherNote };
        }

        if (calls === 0 && !gatherNote) {
          gatherNote = 'the model answered without consulting a source';
        }
        yield {
          type: 'step-finished',
          at: now(),
          stepId: gatherId,
          ok: sectionEvidence.length > 0,
          note: sectionEvidence.length > 0 ? undefined : gatherNote,
        };
      }

      /* ---- draft ---- */
      throwIfAborted(signal);
      const draftId = `${section.id}:draft`;
      yield {
        type: 'step-started',
        at: now(),
        stepId: draftId,
        kind: 'draft',
        label: `Draft ${section.heading}`,
        sectionId: section.id,
      };

      let raw = '';
      let draftFailed = false;
      try {
        for await (const delta of draft({
          model,
          pacer,
          signal,
          prompt: draftPrompt(workflow, section, state, sectionEvidence),
        })) {
          raw += delta;
          yield { type: 'draft-delta', at: now(), sectionId: section.id, delta };
        }
      } catch (error) {
        const note = errorMessage(error);
        draftFailed = true;
        raw = `_This section could not be drafted: ${note}_`;
        state.sourceErrors.push({ source: section.id, message: `draft failed — ${note}` });
        yield { type: 'step-finished', at: now(), stepId: draftId, ok: false, note };
      }

      // Citation ids become source labels here, and an id the model invented
      // becomes a visible marker rather than a dangling `[e9]`.
      const rendered = renderSection(raw, sectionEvidence);
      state.flagged += rendered.invented;
      state.sectionMarkdown.set(section.id, rendered.markdown);

      yield {
        type: 'draft-section',
        at: now(),
        sectionId: section.id,
        heading: section.heading,
        markdown: rendered.markdown,
      };
      if (!draftFailed && raw) {
        yield { type: 'step-finished', at: now(), stepId: draftId, ok: true };
      }

      /* ---- verify ---- */
      // A section that failed to draft holds an error message, not prose.
      // Verifying it produced the genuinely absurd output seen on a live run:
      // the checker read "This section could not be drafted: Failed after 3
      // attempts…" as a factual claim, found no evidence for it, and marked the
      // failure notice itself **[unverified]**.
      if (draftFailed || section.skipVerification || !rendered.markdown.trim()) continue;

      throwIfAborted(signal);
      const verifyId = `${section.id}:verify`;
      yield {
        type: 'step-started',
        at: now(),
        stepId: verifyId,
        kind: 'verify',
        label: `Check claims — ${section.heading}`,
        sectionId: section.id,
      };

      try {
        const checked = await verifySection({
          sectionId: section.id,
          markdown: rendered.markdown,
          evidence: sectionEvidence,
          model,
          pacer,
          signal,
        });

        for (const check of checked.checks) {
          yield {
            type: 'check-run',
            at: now(),
            sectionId: section.id,
            claim: check.claim,
            verdict: check.verdict,
            source: check.source,
          };
        }

        state.flagged += checked.flagged;
        state.sectionMarkdown.set(section.id, checked.markdown);
        yield {
          type: 'section-verified',
          at: now(),
          sectionId: section.id,
          markdown: checked.markdown,
          flagged: checked.flagged,
        };
        yield { type: 'step-finished', at: now(), stepId: verifyId, ok: true };
      } catch (error) {
        // Verification failing is itself a caveat the reader must see: the
        // section stands as drafted, unchecked, and says so.
        const note = errorMessage(error);
        state.sourceErrors.push({
          source: `${section.id} verification`,
          message: `claims in this section were not checked — ${note}`,
        });
        yield { type: 'step-finished', at: now(), stepId: verifyId, ok: false, note };
      }
    }

    yield {
      type: 'workflow-done',
      at: now(),
      generatedAt: new Date(now()).toISOString(),
      sections: state.sectionMarkdown.size,
      flagged: state.flagged,
    };
  } catch (error) {
    yield { type: 'workflow-error', at: now(), message: errorMessage(error) };
  }
}

/* ------------------------------------------------------------------ *
 * Steps
 * ------------------------------------------------------------------ */

/**
 * Resolve a free-text country line to a display name and an ISO3 code.
 *
 * A structured-output call would be the tidy way to do this, but structured
 * output over an OpenAI-compatible endpoint is the least portable thing the SDK
 * offers — it degrades differently on Ollama and on Groq, and this runs on
 * both. A twelve-token completion parsed with a regex works identically
 * everywhere and fails visibly when it fails.
 */
async function resolveCountry(
  subject: string,
  ctx: { model: LanguageModel; pacer: TokenPacer; signal?: AbortSignal },
): Promise<{ display: string; iso3?: string }> {
  const prompt = `Country or territory: "${subject}"

Reply with exactly one line, nothing else:
<English name>|<ISO 3166-1 alpha-3 code>

If it is not a country or territory, or you are not certain of the code, reply:
${subject}|NONE`;

  const estimated = estimateTokens(prompt, 20);
  await ctx.pacer.reserve(estimated);

  try {
    const result = await withRateLimitRetry(() =>
      generateText({
        model: ctx.model,
        providerOptions: getProviderOptions(),
        prompt,
        temperature: 0,
        maxOutputTokens: 24,
        abortSignal: ctx.signal,
      }),
    );
    ctx.pacer.settle(estimated, result.usage?.totalTokens ?? estimated);

    const line = result.text.trim().split('\n')[0] ?? '';
    const [name, code] = line.split('|').map((part) => part.trim());
    const iso3 = code && /^[A-Z]{3}$/.test(code.toUpperCase()) && code.toUpperCase() !== 'NON'
      ? code.toUpperCase()
      : undefined;
    return { display: name || subject, iso3 };
  } catch {
    // The subject line as typed is a perfectly usable document title, and the
    // gather steps carry the country name to the tools regardless.
    return { display: subject };
  }
}

interface GatherContext {
  model: LanguageModel;
  pacer: TokenPacer;
  signal?: AbortSignal;
  stepId: string;
  tools: ToolSet;
  prompt: string;
  now: () => number;
  onHarvest: (tool: string, output: unknown) => { items: EvidenceItem[]; errors: SourceError[] };
}

/**
 * One section's evidence gathering: a short tool-calling loop whose prose
 * output is discarded. Only what the tools returned survives, which is the
 * point — a gather step that could contribute text would contribute text it
 * had not retrieved.
 */
async function* gather(ctx: GatherContext): AsyncGenerator<TraceEvent> {
  // Reserved for the whole loop up front, accumulation included — see
  // `estimateToolLoopTokens`. Reserving per call instead would let the pacer
  // wave three cheap-looking requests through inside one minute and then watch
  // the endpoint refuse the third.
  const estimated =
    estimateTokens(`${STEP_POLICY}${ctx.prompt}`, 0) +
    estimateToolLoopTokens(Object.keys(ctx.tools).length, GATHER_STEP_CAP);
  await ctx.pacer.reserve(estimated);

  const run = () =>
    streamText({
      model: ctx.model,
      providerOptions: getProviderOptions(),
      system: STEP_POLICY,
      prompt: ctx.prompt,
      tools: ctx.tools,
      temperature: 0,
      // One call per step (see `getProviderOptions`) times this cap is the most
      // evidence one section can pull. Three is enough to cross-check a figure
      // against a second source and no more; a fourth mostly re-runs the first.
      stopWhen: stepCountIs(GATHER_STEP_CAP),
      abortSignal: ctx.signal,
    });

  let result = run();
  let sawCall = false;

  for await (const part of result.fullStream) {
    if (part.type === 'tool-call') {
      sawCall = true;
      yield {
        type: 'tool-called',
        at: ctx.now(),
        stepId: ctx.stepId,
        callId: part.toolCallId,
        tool: part.toolName,
        args: summariseArgs(part.input),
      };
    } else if (part.type === 'tool-result') {
      const harvested = ctx.onHarvest(part.toolName, part.output);
      yield {
        type: 'tool-result',
        at: ctx.now(),
        stepId: ctx.stepId,
        callId: part.toolCallId,
        tool: part.toolName,
        ok: harvested.items.length > 0,
        summary: summariseResult(harvested),
      };
      for (const error of harvested.errors) {
        yield { type: 'source-error', at: ctx.now(), source: error.source, message: error.message };
      }
    } else if (part.type === 'tool-error') {
      yield {
        type: 'tool-result',
        at: ctx.now(),
        stepId: ctx.stepId,
        callId: part.toolCallId,
        tool: part.toolName,
        ok: false,
        summary: errorMessage(part.error),
      };
    } else if (part.type === 'error') {
      throw part.error;
    }
  }

  ctx.pacer.settle(estimated, (await result.totalUsage)?.totalTokens ?? estimated);

  if (sawCall) return;

  // The model decided it already knew the answer. That is the exact failure the
  // whole grounding policy exists to prevent, so the step is run once more with
  // the choice taken away rather than accepted as an empty gather.
  const forcedEstimate =
    estimateTokens(ctx.prompt, 0) + estimateToolLoopTokens(Object.keys(ctx.tools).length, 1);
  await ctx.pacer.reserve(forcedEstimate);
  result = streamText({
    model: ctx.model,
    providerOptions: getProviderOptions(),
    system: STEP_POLICY,
    prompt: ctx.prompt,
    tools: ctx.tools,
    toolChoice: 'required',
    temperature: 0,
    stopWhen: stepCountIs(1),
    abortSignal: ctx.signal,
  });

  for await (const part of result.fullStream) {
    if (part.type === 'tool-call') {
      yield {
        type: 'tool-called',
        at: ctx.now(),
        stepId: ctx.stepId,
        callId: part.toolCallId,
        tool: part.toolName,
        args: summariseArgs(part.input),
      };
    } else if (part.type === 'tool-result') {
      const harvested = ctx.onHarvest(part.toolName, part.output);
      yield {
        type: 'tool-result',
        at: ctx.now(),
        stepId: ctx.stepId,
        callId: part.toolCallId,
        tool: part.toolName,
        ok: harvested.items.length > 0,
        summary: summariseResult(harvested),
      };
      for (const error of harvested.errors) {
        yield { type: 'source-error', at: ctx.now(), source: error.source, message: error.message };
      }
    } else if (part.type === 'error') {
      throw part.error;
    }
  }
  ctx.pacer.settle(forcedEstimate, (await result.totalUsage)?.totalTokens ?? forcedEstimate);
}

/** Write one section from its own evidence. No tools, by design. */
async function* draft(ctx: {
  model: LanguageModel;
  pacer: TokenPacer;
  signal?: AbortSignal;
  prompt: string;
}): AsyncGenerator<string> {
  const estimated = estimateTokens(`${STEP_POLICY}${ctx.prompt}`, DRAFT_MAX_WORDS * 2);
  await ctx.pacer.reserve(estimated);

  const result = await withRateLimitRetry(async () =>
    streamText({
      model: ctx.model,
      providerOptions: getProviderOptions(),
      system: STEP_POLICY,
      prompt: ctx.prompt,
      temperature: 0,
      abortSignal: ctx.signal,
    }),
  );

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') yield part.text;
    else if (part.type === 'error') throw part.error;
  }
  ctx.pacer.settle(estimated, (await result.totalUsage)?.totalTokens ?? estimated);
}

/* ------------------------------------------------------------------ *
 * Prompts
 * ------------------------------------------------------------------ */

function subjectLine(workflow: WorkflowDefinition, state: RunState): string {
  if (workflow.subjectKind !== 'country') return `Programme/topic: ${state.subject}`;
  return state.iso3
    ? `Country: ${state.subject} (ISO3 ${state.iso3})`
    : `Country: ${state.subject} (ISO3 code unknown — supply it yourself if you are certain of it)`;
}

function gatherPrompt(
  workflow: WorkflowDefinition,
  section: SectionSpec,
  state: RunState,
): string {
  return `${subjectLine(workflow, state)}
Document: ${workflow.title}
Section: ${section.heading}

Retrieve the evidence this section needs, then stop. ${section.gatherBrief}

Call the tools. Do not write the section, do not summarise what you found, and do not answer from your own knowledge — another step writes the prose from whatever you retrieve. At most ${GATHER_STEP_CAP} tool calls; make each one different from the last.`;
}

function draftPrompt(
  workflow: WorkflowDefinition,
  section: SectionSpec,
  state: RunState,
  evidence: EvidenceItem[],
): string {
  return `${subjectLine(workflow, state)}
Document: ${workflow.title}
Section to write: ${section.heading}

${section.brief}

EVIDENCE (the only facts you may use):
${formatEvidence(evidence)}

Write the section body in markdown. No heading — the heading is added for you.
Under ${DRAFT_MAX_WORDS} words. Prefer a short list or a compact table over paragraphs.

Cite every figure and every substantive claim with the bracketed evidence id it came from, like [e2], placed at the end of the sentence. A sentence with a figure and no id will be rejected. Give the reference period for every figure — it is in the evidence.
If the evidence does not cover part of this section, write one sentence naming what is missing instead of filling the gap.`;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Resolve a template's tool names against the live registry.
 *
 * Names that are not registered are dropped rather than raising. That is what
 * lets a template be written against a tool before it exists and lets a tool be
 * retired without breaking every template that mentioned it — the section
 * degrades to whatever else it named, and the trace says which sources answered.
 */
export function selectTools(
  registry: ToolSet,
  names: readonly string[],
): { set: ToolSet; names: string[] } {
  const set: ToolSet = {};
  const resolved: string[] = [];
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(registry, name)) {
      set[name] = registry[name];
      resolved.push(name);
    }
  }
  return { set, names: resolved };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('The run was cancelled.');
}

/**
 * An error as the document should describe it.
 *
 * Upstream messages are written for whoever is paying the bill, not for whoever
 * is reading the brief. Groq's rate-limit text ends "Need more tokens? Upgrade
 * to Dev Tier today at https://console.groq.com/settings/billing", and on a
 * live run that sentence was rendered verbatim into a humanitarian situation
 * brief's caveats section — a vendor upsell inside a document about a caseload
 * of 33 million people. The reader needs the fact (a section is missing because
 * the run hit the endpoint's per-minute budget), not the sales copy.
 */
function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'unknown error';

  if (isRateLimitError(error)) {
    const retry = /try again in ([\d.]+\s*[a-z]+\d*\.?\d*s?)/i.exec(raw);
    return retry
      ? `the endpoint's per-minute token budget was exhausted (retry after ${retry[1]})`
      : "the endpoint's per-minute token budget was exhausted";
  }

  // Strip any URL: an upstream link in a generated document reads as a source.
  return raw.replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim() || 'unknown error';
}
