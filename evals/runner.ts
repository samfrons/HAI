/**
 * Drives one scenario against the *live* chat route.
 *
 * Deliberately not a unit test against library internals: it POSTs to
 * http://localhost:3000/api/chat exactly as the browser does and reads the
 * AI SDK v7 UI-message stream off the wire. Anything the app does on the way —
 * system prompt, retrieval, tool calls, PII interception, rate limiting — is
 * therefore in scope of the measurement, which is the point. A harness that
 * called the model directly would be grading the model, not the assistant.
 */

import { randomUUID } from 'node:crypto';

import { CHAT_URL, REQUEST_TIMEOUT_MS } from './config.ts';
import { interceptionIsAppropriate, probesFor } from './scenarios.ts';
import type {
  Scenario,
  StreamEvent,
  ToolInvocation,
  Transcript,
  Turn,
} from './types.ts';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
}

/** One turn: send a probe with the history so far, read the whole stream. */
async function sendProbe(probe: string, history: UiMessage[]): Promise<Turn> {
  const startedAt = Date.now();
  const turn: Turn = {
    probe,
    text: '',
    toolCalls: [],
    safetyNotices: [],
    errors: [],
    httpStatus: 0,
    durationMs: 0,
    events: [],
  };

  let response: Response;
  try {
    response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    turn.errors.push(`request failed: ${describe(error)}`);
    turn.durationMs = Date.now() - startedAt;
    return turn;
  }

  turn.httpStatus = response.status;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    turn.errors.push(`HTTP ${response.status}: ${body.slice(0, 500)}`);
    turn.durationMs = Date.now() - startedAt;
    return turn;
  }

  if (!response.body) {
    turn.errors.push('response had no body');
    turn.durationMs = Date.now() - startedAt;
    return turn;
  }

  try {
    for await (const event of readSse(response.body)) {
      turn.events.push(event);
      applyEvent(turn, event);
    }
  } catch (error) {
    turn.errors.push(`stream failed: ${describe(error)}`);
  }

  turn.durationMs = Date.now() - startedAt;
  return turn;
}

/** Folds one stream part into the accumulating turn. */
function applyEvent(turn: Turn, event: StreamEvent): void {
  const type = event.type;

  if (type === 'text-delta' && typeof event.delta === 'string') {
    turn.text += event.delta;
    return;
  }

  if (type === 'error') {
    turn.errors.push(`stream error part: ${String(event.errorText ?? JSON.stringify(event))}`);
    return;
  }

  if (type === 'data-safety-notice') {
    turn.safetyNotices.push(event.data ?? event);
    return;
  }

  if (type === 'tool-input-available') {
    turn.toolCalls.push({
      toolCallId: String(event.toolCallId ?? randomUUID()),
      toolName: String(event.toolName ?? 'unknown'),
      input: event.input,
    });
    return;
  }

  if (type === 'tool-output-available' || type === 'tool-output-error') {
    const call = turn.toolCalls.find((c) => c.toolCallId === event.toolCallId);
    const target =
      call ??
      ({
        toolCallId: String(event.toolCallId ?? randomUUID()),
        toolName: String(event.toolName ?? 'unknown'),
      } as ToolInvocation);
    if (!call) turn.toolCalls.push(target);

    if (type === 'tool-output-error') {
      target.error = String(event.errorText ?? 'tool error');
    } else {
      target.output = event.output;
    }
  }
}

/** Minimal SSE reader: yields the JSON payload of each `data:` line. */
async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      const event = parseSseLine(line);
      if (event) yield event;
    }
  }

  const tail = parseSseLine(buffer.trim());
  if (tail) yield tail;
}

function parseSseLine(line: string): StreamEvent | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice('data:'.length).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    return JSON.parse(payload) as StreamEvent;
  } catch {
    return { type: 'unparseable', raw: payload };
  }
}

export async function runScenario(scenario: Scenario): Promise<Transcript> {
  const startedAt = new Date();
  const history: UiMessage[] = [];
  const turns: Turn[] = [];

  for (const probe of probesFor(scenario)) {
    history.push({
      id: randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: probe }],
    });

    const turn = await sendProbe(probe, history);
    turns.push(turn);

    // A failed turn ends the conversation: continuing would send probes into a
    // history the app never answered, and grade the result as if it had.
    if (turn.errors.length) break;

    history.push({
      id: randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: turn.text }],
    });
  }

  const finishedAt = new Date();
  const errors = turns.flatMap((turn) => turn.errors);

  return {
    scenarioId: scenario.id,
    turns,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    interceptionOccurred: turns.some((turn) => turn.safetyNotices.length > 0),
    interceptionIsAppropriate: interceptionIsAppropriate(scenario),
    failed: errors.length > 0 || turns.every((turn) => turn.text.trim() === ''),
    errors,
  };
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
