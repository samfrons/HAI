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

import { getDeliverablesBudget, getDeliverablesModel, getProviderOptions } from '@/lib/llm/provider';
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
  isDailyLimit,
  isRateLimitError,
  sleep,
  withRateLimitRetry,
} from './pacer';
import { renderSection, renderSourcesAndCaveats } from './render';
import type { SectionSpec, TraceEvent, WorkflowDefinition } from './types';
import { VERIFY_EVIDENCE_CHARS, verifySection } from './verify';

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

/**
 * Explicit output ceilings on every call, and why omitting them was a bug
 * rather than a default.
 *
 * The endpoint admits a request against `prompt + reserved completion`, not
 * against what the completion turns out to be — its refusals say so in as many
 * words: "Limit 8000, Requested 16395". When `maxOutputTokens` is left unset the
 * reservation becomes the model's own maximum, which for the deployed models is
 * 16,384 or 65,536 tokens: two to eight times the entire per-minute ceiling. A
 * gather step with a 2,000-token prompt was therefore being refused for
 * requesting 18,000, at a moment when the endpoint's own headers reported
 * nearly 7,000 tokens free — a 429 that no amount of pacing could have avoided,
 * because the number being rejected was never the number we were pacing.
 *
 * So every call states its ceiling. Sizing them, however, is not simply a
 * matter of how much prose the step should produce, and getting that wrong
 * broke a run in a much quieter way than a 429 does.
 *
 * A reasoning model spends output tokens thinking before it writes anything,
 * and those tokens come out of this same ceiling: a draft call measured against
 * `openai/gpt-oss-120b` used 133 reasoning tokens before its first visible
 * character. Cap the output at what the prose needs and a long prompt produces
 * a completion that is entirely reasoning, truncated at the limit, with no text
 * at all — and the step reports success, because nothing failed. On the first
 * run with caps set to 600 that happened to four of five sections, and the only
 * one that survived was the one with the shortest prompt.
 *
 * So these are sized as reasoning headroom plus the visible answer, and stay far
 * enough under the per-minute ceiling that prompt plus reservation still fits
 * inside it with room for the accumulating tool results.
 */
const GATHER_MAX_OUTPUT = 1_200;
const DRAFT_MAX_OUTPUT = 1_600;
/**
 * The plan step returns one `Name|ISO3` line — but it is a model call like any
 * other, and at 24 tokens a reasoning model spent every one of them thinking
 * and returned nothing. The subject then failed to resolve to an ISO3 code and
 * every country-scoped tool in the run lost its most useful argument.
 */
const RESOLVE_MAX_OUTPUT = 400;

/**
 * Raised when the endpoint's per-day ceiling is shut.
 *
 * Distinct from any other failure because the only useful response is to stop:
 * the sections already written stand, the reader is told plainly that the day's
 * free budget is spent rather than watching a counter, and nothing else is
 * attempted. Caught by `runWorkflow`'s outer handler like anything else, so the
 * run still ends on a `workflow-error` rather than a broken stream.
 */
class DailyBudgetExhausted extends Error {
  constructor(readonly waitMs: number) {
    super(
      'the endpoint\'s free daily token budget for this model is used up; the run stopped rather than waiting for it to reset',
    );
    this.name = 'DailyBudgetExhausted';
  }
}

/**
 * Announce a pacing wait, serve it, and say when it is over.
 *
 * Hoisted out of the individual steps and into the generator on purpose. The
 * pacer can only sleep; it cannot emit, because it is not the thing the route
 * is iterating. Leaving the wait inside `reserve` is what made the trace panel
 * stop dead for forty seconds at a time with nothing said — and a progress view
 * that goes silent during the longest part of the run is worse than no progress
 * view, because the reader's only available conclusion is that it broke.
 */
async function* awaitBudget(
  pacer: TokenPacer,
  tokens: number,
  now: () => number,
  stepId?: string,
): AsyncGenerator<TraceEvent> {
  const daily = pacer.dailyBlockMs();
  if (daily > 0) {
    yield { type: 'budget-wait', at: now(), waitMs: daily, scope: 'tokens-per-day', stepId };
    throw new DailyBudgetExhausted(daily);
  }

  const wait = pacer.waitFor(tokens);
  if (wait <= 0) return;

  yield { type: 'budget-wait', at: now(), waitMs: wait, scope: 'tokens-per-minute', stepId };
  await sleep(wait);
  yield { type: 'budget-resumed', at: now(), stepId };
}

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */

export interface WorkflowRunInput {
  workflow: WorkflowDefinition;
  /** The user's country or topic line. Already PII-screened by the route. */
  subject: string;
  signal?: AbortSignal;
  /**
   * Epoch ms after which no further section may be started.
   *
   * The serverless function this runs inside has a hard lifetime, and a run
   * killed at that boundary takes the stream with it: the document stops
   * mid-sentence with no caveat and no way for the reader to tell an empty
   * section from an unattempted one. Given a deadline the engine stops one
   * section early and says so, which is the same amount of document and a great
   * deal more information. Omitted by tests and by any caller without a
   * lifetime to respect.
   */
  deadline?: number;
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
  const model = deps.model ?? getDeliverablesModel();
  const registry = deps.tools ?? (haiTools as unknown as ToolSet);
  const pacer = deps.pacer ?? new TokenPacer(getDeliverablesBudget());
  const now = deps.now ?? Date.now;
  const { workflow, subject, signal, deadline } = input;

  const state: RunState = {
    subject: subject.trim(),
    evidence: [],
    sourceErrors: [],
    sectionMarkdown: new Map(),
    flagged: 0,
    evidenceCounter: 0,
  };

  const nextEvidenceId = () => `e${++state.evidenceCounter}`;
  /** Set once the run runs out of time, so the caveat is recorded only once. */
  let outOfTime = false;

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

      // Checked per section rather than per call: a section is the smallest
      // unit that is worth anything on its own, and abandoning one halfway
      // leaves a heading with a truncated paragraph under it.
      //
      // Skipped rather than broken out of, so that the synthesised sources and
      // caveats block still assembles. A truncated run is precisely the run
      // whose reader most needs it: it is the only part of the document that
      // says which sections are missing and why.
      if (deadline !== undefined && now() >= deadline && !section.synthesised) {
        if (!outOfTime) {
          outOfTime = true;
          const message =
            'the run reached the time limit for a single request; the sections after this one were not attempted';
          state.sourceErrors.push({ source: 'run', message });
          yield { type: 'source-error', at: now(), source: 'run', message };
        }
        continue;
      }

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
        const gatherPromptText = gatherPrompt(workflow, section, state);

        try {
          yield* awaitBudget(pacer, gatherCost(gatherPromptText, activeTools.names.length), now, gatherId);
          for await (const event of gather({
            model,
            pacer,
            signal,
            stepId: gatherId,
            tools: activeTools.set,
            prompt: gatherPromptText,
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
          //
          // Unless the endpoint has closed for the day, which is not a property
          // of this section and will not be different for the next one. Letting
          // that degrade section by section would produce a document whose every
          // section blamed its own sources for a single account-level fact.
          if (isDailyLimit(error)) throw new DailyBudgetExhausted(0);
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
      const draftPromptText = draftPrompt(workflow, section, state, sectionEvidence);
      try {
        yield* awaitBudget(pacer, draftCost(draftPromptText), now, draftId);
        for await (const delta of draft({
          model,
          pacer,
          signal,
          prompt: draftPromptText,
        })) {
          raw += delta;
          yield { type: 'draft-delta', at: now(), sectionId: section.id, delta };
        }
      } catch (error) {
        if (isDailyLimit(error)) throw new DailyBudgetExhausted(0);
        const note = errorMessage(error);
        draftFailed = true;
        raw = `_This section could not be drafted: ${note}_`;
        state.sourceErrors.push({ source: section.id, message: `draft failed — ${note}` });
        yield { type: 'step-finished', at: now(), stepId: draftId, ok: false, note };
      }

      // A call that succeeded and returned no prose. Rare, and it used to pass
      // in total silence: the section was written as an empty string, the step
      // emitted no `step-finished` at all, and the finished document simply had
      // a heading with nothing under it and nothing in the caveats to say why.
      // The cause is above — an output ceiling consumed entirely by a reasoning
      // model's hidden tokens — but any future cause deserves the same
      // treatment, because a silently missing section is the one failure mode a
      // document like this must never have.
      if (!draftFailed && !raw.trim()) {
        draftFailed = true;
        const note = 'the model returned an empty completion for this section';
        raw = `_This section could not be drafted: ${note}._`;
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
        yield* awaitBudget(pacer, verifyCost(rendered.markdown, sectionEvidence), now, verifyId);
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

  const estimated = estimateTokens(prompt, RESOLVE_MAX_OUTPUT);
  await ctx.pacer.reserve(estimated);

  try {
    const result = await withRateLimitRetry(() =>
      generateText({
        model: ctx.model,
        providerOptions: getProviderOptions(),
        prompt,
        temperature: 0,
        maxOutputTokens: RESOLVE_MAX_OUTPUT,
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
      maxOutputTokens: GATHER_MAX_OUTPUT,
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
    maxOutputTokens: GATHER_MAX_OUTPUT,
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

  // Not wrapped in `withRateLimitRetry`, deliberately. `streamText` returns
  // synchronously and reports failures as an `error` part in the stream, so a
  // retry around the call can never fire — it would be a comforting no-op. The
  // SDK's own `maxRetries` already backs off inside the call, the pacer is what
  // stops a rate limit being reached in the first place, and a draft that still
  // fails degrades to a named caveat, which is the honest outcome.
  const result = streamText({
    model: ctx.model,
    providerOptions: getProviderOptions(),
    system: STEP_POLICY,
    prompt: ctx.prompt,
    temperature: 0,
    maxOutputTokens: DRAFT_MAX_OUTPUT,
    abortSignal: ctx.signal,
  });

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
 * Cost projection
 * ------------------------------------------------------------------ */

/*
 * What each step is about to cost, projected before it runs.
 *
 * These mirror the reservations the steps themselves make, and exist as
 * separate functions for one reason: the wait has to be announced by the
 * generator, and the generator therefore has to know the number before the step
 * it belongs to is entered. Kept beside the prompt builders so that a prompt
 * that grows and a projection that does not stay visibly out of step.
 *
 * A projection being somewhat wrong is now cheap. It decides only how long to
 * pause before asking; what the call actually spent comes back from the
 * endpoint's own headers a moment later — see `lib/llm/rate-limit.ts`.
 */

export function gatherCost(prompt: string, toolCount: number): number {
  return (
    estimateTokens(`${STEP_POLICY}${prompt}`, GATHER_MAX_OUTPUT) +
    estimateToolLoopTokens(toolCount, GATHER_STEP_CAP)
  );
}

export function draftCost(prompt: string): number {
  return estimateTokens(`${STEP_POLICY}${prompt}`, DRAFT_MAX_OUTPUT);
}

export function verifyCost(markdown: string, evidence: EvidenceItem[]): number {
  return estimateTokens(`${markdown}${formatEvidence(evidence, VERIFY_EVIDENCE_CHARS)}`, 300);
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
