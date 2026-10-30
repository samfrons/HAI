/**
 * A scripted language model for engine tests.
 *
 * The engine's job is to sequence model calls and turn what comes back into a
 * document plus a trace. Testing that against a real endpoint would test the
 * endpoint; testing it against a model that replies by inspecting the prompt it
 * was given tests the engine — including the paths that only occur when the
 * model misbehaves, which are the ones that matter here and which a real model
 * cannot be asked to produce on demand.
 *
 * Not a `.test.ts` file, so vitest does not collect it as a suite.
 */

import type { LanguageModel } from 'ai';
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';

const USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 50, text: 50, reasoning: 0 },
};

/**
 * The provider spec takes a finish reason as `{ unified, raw }`, not a bare
 * string, and the SDK reads `.unified` to decide whether client-side tools may
 * run. A mock that returns the string silently produces a step with a tool call
 * in it and no tool result — the call streams, `execute` is never invoked, and
 * the loop stops after one step. Worth stating plainly: it fails as "the engine
 * did not gather anything" rather than as a type error.
 */
function finishReason(toolCalls: boolean) {
  return toolCalls
    ? { unified: 'tool-calls' as const, raw: 'tool_calls' }
    : { unified: 'stop' as const, raw: 'stop' };
}

type Part =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolName: string; input: Record<string, unknown> };

export function text(value: string): Part {
  return { kind: 'text', text: value };
}

export function toolCall(toolName: string, input: Record<string, unknown> = {}): Part {
  return { kind: 'tool', toolName, input };
}

/** Everything the model was sent, flattened, so a script can branch on it. */
export function promptText(options: { prompt: unknown }): string {
  const messages = options.prompt as Array<{ role: string; content: unknown }>;
  const chunks: string[] = [];
  for (const message of messages ?? []) {
    if (typeof message.content === 'string') {
      chunks.push(message.content);
      continue;
    }
    for (const part of (message.content as Array<Record<string, unknown>>) ?? []) {
      if (part && part.type === 'text' && typeof part.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('\n');
}

/**
 * Build a model whose reply is chosen by `script` from the prompt it receives.
 * Returning an empty array is a model that says nothing, which is itself a case
 * the engine has to handle.
 */
export function scriptedModel(script: (prompt: string, callIndex: number) => Part[]): LanguageModel {
  let callIndex = 0;

  return new MockLanguageModelV4({
    doStream: async (options) => {
      const parts = script(promptText(options), callIndex++);
      const chunks: unknown[] = [{ type: 'stream-start', warnings: [] }];
      let toolCalls = 0;

      for (const [index, part] of parts.entries()) {
        if (part.kind === 'text') {
          const id = `t${index}`;
          chunks.push({ type: 'text-start', id });
          // Split so the engine's delta handling is exercised rather than
          // receiving each section as a single block.
          for (const word of part.text.split(/(?<= )/)) {
            chunks.push({ type: 'text-delta', id, delta: word });
          }
          chunks.push({ type: 'text-end', id });
        } else {
          toolCalls += 1;
          chunks.push({
            type: 'tool-call',
            toolCallId: `call-${callIndex}-${index}`,
            toolName: part.toolName,
            input: JSON.stringify(part.input),
          });
        }
      }

      chunks.push({
        type: 'finish',
        finishReason: finishReason(toolCalls > 0),
        usage: USAGE,
      });

      // Cast at the boundary: the provider spec's stream-part union is not
      // exported from a direct dependency, and spelling it out here would pin
      // the test helper to a package the app does not otherwise import.
      return { stream: convertArrayToReadableStream(chunks) } as never;
    },

    doGenerate: async (options) => {
      const parts = script(promptText(options), callIndex++);
      return {
        content: parts.map((part) =>
          part.kind === 'text'
            ? { type: 'text' as const, text: part.text }
            : {
                type: 'tool-call' as const,
                toolCallId: `gen-${callIndex}`,
                toolName: part.toolName,
                input: JSON.stringify(part.input),
              },
        ),
        finishReason: finishReason(parts.some((part) => part.kind === 'tool')),
        usage: USAGE,
        warnings: [],
      } as never;
    },
  }) as unknown as LanguageModel;
}
