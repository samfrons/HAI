import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';

import { runWorkflow } from '@/lib/agent/engine';
import type { TraceEvent } from '@/lib/agent/types';
import { WORKFLOWS, isWorkflowId } from '@/lib/agent/workflows';
import { claimDailyRequest, dailyCapMessage } from '@/lib/limits/daily-cap';
import { clientKey, createBurstLimiter } from '@/lib/limits/burst';
import { buildInterceptionMessage } from '@/lib/safety/intercept';
import { llmScreen } from '@/lib/safety/llm-screen';
import { screenForPii } from '@/lib/safety/pii';
import { warmEmbeddingsEndpoint } from '@/lib/retrieval/embeddings';
import { warmSupabaseConnection } from '@/lib/retrieval/search';

export const dynamic = 'force-dynamic';

/*
 * The wall clock a complete brief needs, with margin — and the binding
 * constraint on this route rather than a comfortable one, which is the opposite
 * of the chat route's situation and worth being explicit about.
 *
 * A situation brief is nineteen model calls. Against hosted inference those are
 * fast; what takes the time is the pacing. The free tier meters 8,000 tokens a
 * minute and a full run spends roughly 25,000, so `lib/agent/pacer.ts`
 * deliberately waits out the difference. A measured end-to-end Sudan brief —
 * six sections, every one populated, no request refused — took 142 seconds, of
 * which about 105 were spent idle inside those waits on purpose.
 *
 * So this is 300, Vercel's ceiling with Fluid compute (the default for new
 * projects, Hobby included), and the measured run leaves roughly a two-times
 * margin under it. That margin is real but it is not unlimited: the token
 * bucket is shared with anything else on the same key, so a run competing with
 * chat traffic paces harder and takes longer.
 *
 * Two things follow, neither hidden from the user. The stream is written
 * incrementally, so a run cut short still leaves the reader the sections that
 * finished rather than nothing, and the client says the document is partial.
 * And the engine stops itself before the platform can — see `deadline` below —
 * so the last thing a truncated run does is explain itself rather than having
 * its connection dropped mid-sentence.
 *
 * Local `next dev` and `next start` ignore this value entirely.
 */
export const maxDuration = 300;

/**
 * Margin left for the run to end tidily inside the function's lifetime.
 *
 * A serverless function that hits its ceiling is killed, and a killed stream is
 * the one failure the reader cannot interpret: the document simply stops, with
 * no caveat, no timestamp, and no indication whether the missing sections were
 * empty or never attempted. Ending the run ourselves a few seconds early costs
 * one section and buys an honest ending.
 */
const DEADLINE_MARGIN_MS = 15_000;

// cost: $0.00 per run with the default local Ollama endpoint. A hosted
// LLM_BASE_URL may bill per token, and one run is ~16 calls, not one.

/**
 * One run's worth of trace, streamed as data parts.
 *
 * Every event goes over the wire as `data-trace`. The client keeps the whole
 * sequence and derives both views from it — the assembling document on the left
 * and the trace panel on the right — so there is exactly one source of truth for
 * what happened, and the document can never show a section the trace does not
 * account for.
 */
export type DeliverableDataParts = {
  trace: TraceEvent;
};

export type DeliverableUIMessage = UIMessage<never, DeliverableDataParts>;

/*
 * Three runs per ten minutes per IP.
 *
 * Much tighter than chat's twenty a minute, because the unit is not comparable:
 * a run is roughly sixteen model calls and several live API round trips, and it
 * occupies a serverless function for minutes. Someone legitimately using this
 * generates a brief, reads it, and edits it; nobody needs a fourth inside ten
 * minutes, and a script that does is the case this exists for.
 */
const runLimiter = createBurstLimiter(3, 10 * 60_000);

/** Bounds what can be spent on resolving a subject line. */
const MAX_SUBJECT_CHARS = 120;

export async function POST(request: Request) {
  // Same rationale as the chat route: the first tool call is still a model round
  // trip away, and warming these now means retrieval is hot when a gather step
  // reaches it rather than paying a cold start inside the run.
  warmEmbeddingsEndpoint();
  warmSupabaseConnection();

  if (runLimiter.isLimited(clientKey(request))) {
    return Response.json(
      {
        error:
          'Rate limit exceeded — 3 deliverables per 10 minutes. Each run makes many model calls; wait a few minutes and try again.',
      },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }

  /*
   * Claimed once, like a chat message, even though a run costs far more than
   * one. Weighting it properly would mean either changing the shared counter's
   * contract or making sixteen sequential round trips before any work starts,
   * and a partial claim that then fails would burn budget for nothing. The
   * burst limiter above is what bounds the real cost here; this keeps the
   * hosted deployment's single day-counter honest about traffic.
   */
  const daily = await claimDailyRequest();
  if (!daily.allowed) {
    return Response.json({ error: dailyCapMessage(daily) }, { status: 429 });
  }

  let workflowId: string;
  let subject: string;
  try {
    ({ workflowId, subject } = (await request.json()) as {
      workflowId: string;
      subject: string;
    });
  } catch {
    return Response.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  if (typeof workflowId !== 'string' || !isWorkflowId(workflowId)) {
    return Response.json({ error: 'Unknown deliverable template.' }, { status: 400 });
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return Response.json(
      { error: 'Name the country or topic this deliverable is about.' },
      { status: 400 },
    );
  }
  if (subject.length > MAX_SUBJECT_CHARS) {
    return Response.json(
      { error: `Keep the subject under ${MAX_SUBJECT_CHARS} characters.` },
      { status: 400 },
    );
  }

  /*
   * Screened before anything else touches it — no retrieval, no model call, no
   * logging. The subject line is short, but it is a free-text field on a
   * humanitarian tool, which makes it exactly the place someone pastes a
   * beneficiary name or a phone number while meaning to name a caseload.
   *
   * The refusal streams as a normal run that produces no document, rather than
   * as a 4xx. A red error banner frames a correct data-responsibility decision
   * as a broken app, which is the reading most likely to send someone to a tool
   * with no screening at all — the same reasoning as the chat route's.
   */
  const deterministic = screenForPii(subject);
  if (deterministic.flagged) {
    return refusalStream(buildInterceptionMessage(deterministic.findings));
  }
  const semantic = await llmScreen(subject);
  if (semantic) {
    return refusalStream(buildInterceptionMessage([semantic]));
  }

  const workflow = WORKFLOWS[workflowId];

  const stream = createUIMessageStream<DeliverableUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'start-step' });

      for await (const event of runWorkflow({
        workflow,
        subject,
        signal: request.signal,
        deadline: Date.now() + maxDuration * 1_000 - DEADLINE_MARGIN_MS,
      })) {
        writer.write({ type: 'data-trace', data: event });
      }

      writer.write({ type: 'finish-step' });
      writer.write({ type: 'finish' });
    },
    onError: (error) =>
      error instanceof Error ? error.message : 'The run hit an unexpected error.',
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * A refused subject line, delivered as a completed run with one error event.
 * The client already knows how to render `workflow-error`, so this needs no
 * special case on the other side.
 */
function refusalStream(message: string): Response {
  const stream = createUIMessageStream<DeliverableUIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'start-step' });
      writer.write({
        type: 'data-trace',
        data: { type: 'workflow-error', at: Date.now(), message },
      });
      writer.write({ type: 'finish-step' });
      writer.write({ type: 'finish' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
