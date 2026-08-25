import { anthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from 'ai';

import { SYSTEM_PROMPT } from '@/lib/prompts/system';
import { haiTools } from '@/lib/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// cost: ~$0.003-0.03 per message (Claude Sonnet input+output, varies with tool loops)

/** Shared with the client so message parts are typed against the real tools. */
export type HaiUIMessage = UIMessage<never, UIDataTypes, InferUITools<typeof haiTools>>;

const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Per-IP rate limit held in process memory. This is genuinely not a production
 * rate limiter: it resets on deploy, and every serverless instance keeps its
 * own counter, so the effective limit is the configured one multiplied by the
 * number of live instances. Anything user-facing needs durable shared storage
 * (Redis, Upstash, or a database table) before it can be relied on.
 */
const requestLog = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (requestLog.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
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

export async function POST(request: Request) {
  if (isRateLimited(clientKey(request))) {
    return Response.json(
      {
        error: `Rate limit exceeded — ${RATE_LIMIT_PER_MINUTE} messages per minute. Wait a moment and try again.`,
      },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  let messages: HaiUIMessage[];
  try {
    ({ messages } = (await request.json()) as { messages: HaiUIMessage[] });
  } catch {
    return Response.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'No messages provided.' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-sonnet-5'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: haiTools,
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
