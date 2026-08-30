import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type InferUITools,
  type UIMessage,
} from 'ai';

import { claimDailyRequest, dailyCapMessage } from '@/lib/limits/daily-cap';
import { getChatModel } from '@/lib/llm/provider';
import { COACH_SYSTEM_PROMPT } from '@/lib/prompts/coach';
import { SYSTEM_PROMPT } from '@/lib/prompts/system';
import {
  buildInterceptionMessage,
  buildSafetyNotice,
  type SafetyNoticeData,
} from '@/lib/safety/intercept';
import { llmScreen } from '@/lib/safety/llm-screen';
import { screenForPii, type PiiFinding } from '@/lib/safety/pii';
import { haiTools } from '@/lib/tools';

export const dynamic = 'force-dynamic';

/*
 * Serverless execution budget, and a Vercel-only concern — `next dev` and
 * `next start` ignore it, so the local demo is unaffected by this number.
 *
 * 60 rather than the 120 a slow local model wants, because Vercel's Hobby plan
 * caps functions at 60s without Fluid compute and rejects the deployment
 * outright above it. Hosted inference is fast enough that this is not the
 * binding constraint: a multi-step tool-calling turn against Groq finishes well
 * inside it. Raise it if you deploy on a plan that allows more.
 */
export const maxDuration = 60;

// cost: $0.00 per message — inference runs locally through Ollama by default.
// Pointing LLM_BASE_URL at a hosted endpoint may introduce per-token billing.

/** Custom data parts HAI streams alongside text. */
export type HaiDataParts = {
  'safety-notice': SafetyNoticeData;
};

/** Shared with the client so message parts are typed against the real tools. */
export type HaiUIMessage = UIMessage<never, HaiDataParts, InferUITools<typeof haiTools>>;

const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function ratePerMinute(): number {
  const parsed = Number.parseInt(process.env.RATE_LIMIT_RPM ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT_PER_MINUTE;
}

/**
 * Per-IP rate limit held in process memory. This is genuinely not a production
 * rate limiter: it resets on deploy, and every serverless instance keeps its
 * own counter, so the effective limit is the configured one multiplied by the
 * number of live instances. On Vercel that multiplier is whatever the platform
 * decides to scale to, which is exactly why it is paired with the shared daily
 * cap below rather than trusted on its own — this one paces a single impatient
 * browser, and `claimDailyRequest` is what actually bounds a day.
 */
const requestLog = new Map<string, number[]>();

/** The daily counter rolls over on the database's `current_date`, i.e. UTC. */
function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (requestLog.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= ratePerMinute()) {
    requestLog.set(key, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(key, recent);

  // Opportunistic sweep so the map does not grow without bound.
  if (requestLog.size > 5_000) {
    for (const [entryKey, timestamps] of requestLog) {
      if (timestamps.every((at) => at <= cutoff)) requestLog.delete(entryKey);
    }
  }

  return false;
}

/* ------------------------------------------------------------------ *
 * Data-responsibility screening
 * ------------------------------------------------------------------ */

const WITHHELD_PLACEHOLDER =
  '[An earlier message in this conversation was withheld by data-responsibility screening. Its content was not retained.]';

function messageText(message: HaiUIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

/**
 * The client keeps every message it has sent, including one that was refused.
 * Left alone, a flagged message would be replayed to the model on the very next
 * turn — screening would have delayed the exposure by one request rather than
 * prevented it. So earlier flagged turns are replaced with a placeholder before
 * the history is converted, and only the newest message triggers a refusal.
 * That also means one bad paste never strands the conversation: the user can
 * carry on, and the model simply never sees it.
 */
function withHistoryRedacted(
  messages: HaiUIMessage[],
  newestUserMessage: HaiUIMessage | undefined,
): HaiUIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'user') return message;
    if (message === newestUserMessage) return message;
    if (!screenForPii(messageText(message)).flagged) return message;

    return {
      ...message,
      parts: [{ type: 'text' as const, text: WITHHELD_PLACEHOLDER }],
    };
  });
}

/**
 * The refusal is streamed as an ordinary assistant message rather than returned
 * as an HTTP error. A 4xx renders in the UI as a red "something went wrong"
 * banner, which frames a correct data-responsibility decision as a broken app —
 * the reading most likely to send someone to paste the same thing into a tool
 * with no screening at all.
 */
function interceptionResponse(findings: PiiFinding[]): Response {
  const notice = buildSafetyNotice(findings);
  const body = buildInterceptionMessage(findings);

  const stream = createUIMessageStream<HaiUIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'start-step' });
      writer.write({ type: 'data-safety-notice', data: notice });
      writer.write({ type: 'text-start', id: 'safety-refusal' });
      writer.write({ type: 'text-delta', id: 'safety-refusal', delta: body });
      writer.write({ type: 'text-end', id: 'safety-refusal' });
      writer.write({ type: 'finish-step' });
      writer.write({ type: 'finish' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export async function POST(request: Request) {
  if (isRateLimited(clientKey(request))) {
    return Response.json(
      {
        error: `Rate limit exceeded — ${ratePerMinute()} messages per minute. Wait a moment and try again.`,
      },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  // Claimed before the body is even parsed: a request that cannot be served
  // should not cost a model call, a retrieval round-trip, or a screening pass.
  // No-ops entirely in local mode, where inference is free.
  const daily = await claimDailyRequest();
  if (!daily.allowed) {
    return Response.json(
      { error: dailyCapMessage(daily) },
      // Until 00:00 UTC, so a client that honours Retry-After waits for the
      // actual reset instead of hammering the endpoint for the rest of the day.
      { status: 429, headers: { 'Retry-After': String(secondsUntilUtcMidnight()) } },
    );
  }

  let messages: HaiUIMessage[];
  let mode: 'default' | 'coach';
  try {
    ({ messages, mode = 'default' } = (await request.json()) as {
      messages: HaiUIMessage[];
      mode?: 'default' | 'coach';
    });
  } catch {
    return Response.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'No messages provided.' }, { status: 400 });
  }

  // Screen before anything else touches the text: no logging, no retrieval, no
  // model call. What comes back is masked, so the refusal, the stream, and the
  // UI all handle shapes rather than values.
  const newestUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const newestUserText = newestUserMessage ? messageText(newestUserMessage) : '';

  const deterministic = screenForPii(newestUserText);
  if (deterministic.flagged) {
    return interceptionResponse(deterministic.findings);
  }

  // Only reached when the regex pass found nothing, so the extra round-trip is
  // paid on clean messages rather than obvious ones. Off unless PII_LLM_SCREEN=true.
  const semantic = await llmScreen(newestUserText);
  if (semantic) {
    return interceptionResponse([semantic]);
  }

  const result = streamText({
    model: getChatModel(),
    system: mode === 'coach' ? COACH_SYSTEM_PROMPT : SYSTEM_PROMPT,
    messages: await convertToModelMessages(
      withHistoryRedacted(messages, newestUserMessage),
    ),
    tools: haiTools,
    // Near-deterministic on purpose. This assistant reports thresholds and
    // figures; sampling variety buys nothing here and measurably costs
    // tool-calling reliability on smaller local models, which at higher
    // temperatures drift out of the user's language mid-answer.
    temperature: 0,
    // Multi-step: the model searches the standards, reads what came back, and
    // then answers — each of those is a step, and a grounded answer that
    // consults several sources needs several.
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof Error ? error.message : 'The assistant hit an unexpected error.',
  });
}
