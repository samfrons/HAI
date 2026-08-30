import { streamText, stepCountIs, tool } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { getChatModel, getLlmConfig, isLocalInference } from './provider';

/**
 * Live check that the configured hosted endpoint can actually drive HAI's tool
 * loop through the AI SDK.
 *
 * This is the one thing a deployment cannot assume. HAI is not a chat app with
 * an optional search feature — its whole grounding contract is that it calls
 * `search_standards` before stating any figure, and a model that streams fluent
 * prose while ignoring the tool is *worse* than one that errors, because it
 * produces confident unsourced numbers with section references attached. An
 * endpoint being OpenAI-compatible for plain completions says nothing about
 * whether tool calls survive streaming through this provider.
 *
 * Skipped unless pointed at a hosted endpoint, so `pnpm test` stays offline and
 * deterministic by default. Run it before trusting a deployment:
 *
 *   LLM_BASE_URL=https://api.groq.com/openai/v1 \
 *   LLM_MODEL=openai/gpt-oss-120b \
 *   LLM_API_KEY=gsk_... \
 *     pnpm test hosted-tool-calling
 */
describe.skipIf(isLocalInference())('hosted endpoint tool calling', () => {
  // A stub rather than the real search tool: this is testing the transport, not
  // retrieval, and it must not depend on a corpus being reachable from CI.
  const tools = {
    search_standards: tool({
      description:
        'Search the humanitarian standards corpus for passages relevant to a question.',
      inputSchema: z.object({
        query: z.string().describe('What to look for.'),
      }),
    }),
  };

  it('streams a tool call rather than answering from memory', async () => {
    const result = streamText({
      model: getChatModel(),
      system:
        'You must call search_standards before stating any humanitarian standard, figure, or threshold. Never answer such a question from memory.',
      prompt: 'What is the Sphere minimum litres of water per person per day?',
      tools,
      temperature: 0,
      stopWhen: stepCountIs(1),
    });

    // Drain the stream: a provider that mis-frames tool-call deltas typically
    // throws here rather than at call time.
    await result.consumeStream();

    const calls = await result.toolCalls;

    expect(
      calls.map((call) => call.toolName),
      `${getLlmConfig().model} did not call the tool — it is not usable for HAI`,
    ).toContain('search_standards');
  }, 60_000);
});
