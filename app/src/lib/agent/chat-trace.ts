/**
 * The chat's answers, expressed in the same trace vocabulary as a deliverable.
 *
 * # Why this reads the message rather than the server emitting it
 *
 * The deliverables route emits `TraceEvent`s because the engine knows things the
 * client cannot reconstruct — which evidence a section was given, what the
 * verifier decided. A chat turn has no such hidden state. Everything it did is
 * already in the message the client is holding: which tools were called, with
 * what arguments, and what came back. Emitting a parallel event stream from the
 * chat route would add a second source of truth for facts the first one already
 * carries, and put a write on a hot path shared with other work in flight.
 *
 * So the chat trace is derived here, from the message parts, and rendered by the
 * same `TraceList` the deliverables panel uses. If the two ever disagree it will
 * be because the message and the panel disagree, which is visible.
 *
 * # What it deliberately does not claim
 *
 * No `check-run` events. Chat answers are not verified — the self-check is a
 * workflow step, and the token budget for a conversational turn does not stretch
 * to one. Showing a verdict here would be the single most misleading thing this
 * file could do: a reader who has seen claims checked on the deliverables page
 * would reasonably read the same panel in chat as the same guarantee. The chat
 * trace says which sources were consulted, and nothing more.
 */

import { summariseArgs } from './evidence';
import type { TraceEvent } from './types';

/** The shape this needs from a UI message, kept structural so `HaiUIMessage` stays in the route. */
interface MessageLike {
  parts: ReadonlyArray<{ type: string } & Record<string, unknown>>;
}

const STEP_ID = 'chat';

/**
 * A tool result summarised for the trace, without the harvesting the engine
 * does. Chat tool output is rendered properly by the citations panel; this only
 * needs to say whether the call worked and roughly what came back.
 */
function summarise(output: unknown): { ok: boolean; summary: string } {
  if (output === null || output === undefined) return { ok: false, summary: 'no result' };

  if (typeof output === 'object') {
    const record = output as Record<string, unknown>;

    if (typeof record.error === 'string' && record.error) {
      return { ok: false, summary: record.error };
    }
    if (record.available === false) {
      const detail = typeof record.detail === 'string' ? record.detail : undefined;
      const reason = typeof record.reason === 'string' ? record.reason : undefined;
      return { ok: false, summary: detail ?? reason ?? 'no data available' };
    }
    if (typeof record.notice === 'string' && record.notice) {
      return { ok: false, summary: record.notice };
    }

    // The payload is whichever array came back — `chunks`, `updates`, `figures`.
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'errors' && Array.isArray(value) && value.length > 0) {
        return {
          ok: true,
          summary: `${value.length} ${key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}`,
        };
      }
    }
    return { ok: true, summary: 'result returned' };
  }

  return { ok: true, summary: String(output).slice(0, 120) };
}

/**
 * Trace events for one assistant message, in message order.
 *
 * `at` is 0 throughout: a finished chat message carries no timestamps, and
 * inventing them from render time would put a plausible-looking wrong number in
 * front of someone who has been told this panel is the honest account.
 */
export function traceFromMessage(message: MessageLike): TraceEvent[] {
  const events: TraceEvent[] = [];

  for (const [index, part] of message.parts.entries()) {
    if (!part.type.startsWith('tool-')) continue;

    const tool = part.type.slice('tool-'.length);
    const callId = typeof part.toolCallId === 'string' ? part.toolCallId : `${tool}-${index}`;
    const state = typeof part.state === 'string' ? part.state : undefined;

    events.push({
      type: 'tool-called',
      at: 0,
      stepId: STEP_ID,
      callId,
      tool,
      args: summariseArgs(part.input),
    });

    if (state === 'output-error') {
      events.push({
        type: 'tool-result',
        at: 0,
        stepId: STEP_ID,
        callId,
        tool,
        ok: false,
        summary: typeof part.errorText === 'string' ? part.errorText : 'the tool failed',
      });
    } else if (state === 'output-available') {
      const { ok, summary } = summarise(part.output);
      events.push({ type: 'tool-result', at: 0, stepId: STEP_ID, callId, tool, ok, summary });
    }
    // A call still in flight gets no result row — `ToolActivity` above the
    // disclosure is already showing it running.
  }

  return events;
}
