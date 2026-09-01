import { streamText, stepCountIs, tool } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { getChatModel, getLlmConfig, getProviderOptions, isLocalInference } from './provider';

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

  /*
   * The step-one test above passes against a configuration that is still
   * broken, which is exactly how this shipped once. A reasoning model returns
   * `reasoning_content`; the SDK sends it back with the assistant message on
   * step two; Groq rejects its own field; and the run dies *after* the tool
   * call, so the user watches a search succeed and then gets no answer. Only a
   * multi-step run sees it — hence this second test, which feeds a tool result
   * back and insists on prose afterwards.
   */
  it('completes a second step after a tool result', async () => {
    const answeringTools = {
      search_standards: tool({
        description:
          'Search the humanitarian standards corpus for passages relevant to a question.',
        inputSchema: z.object({
          query: z.string().describe('What to look for.'),
        }),
        execute: async () => ({
          chunks: [
            {
              source: 'sphere',
              section: 'Water supply standard 2.1',
              text: 'The minimum water quantity for drinking, cooking and personal hygiene is 15 litres per person per day.',
            },
          ],
        }),
      }),
    };

    const result = streamText({
      model: getChatModel(),
      providerOptions: getProviderOptions(),
      system:
        'You must call search_standards before stating any humanitarian standard, figure, or threshold. After the search returns, answer the question using what it returned.',
      prompt: 'What is the Sphere minimum litres of water per person per day?',
      tools: answeringTools,
      temperature: 0,
      stopWhen: stepCountIs(4),
    });

    await result.consumeStream();

    const text = await result.text;
    const finish = await result.finishReason;

    expect(
      finish,
      `run ended with finishReason "${finish}" — if this is "error", the endpoint rejected the second request; try LLM_REASONING_FORMAT=hidden`,
    ).not.toBe('error');
    expect(text.length, 'the model called the tool but never produced an answer').toBeGreaterThan(0);
    expect(text).toContain('15');
  }, 90_000);
});
