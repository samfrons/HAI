import { tool } from 'ai';
import { z } from 'zod';

import { searchStandards } from '@/lib/retrieval/search';

// cost: free — local retrieval over the ingested corpus, no third-party call.

/*
 * Retrieval is free; putting what it returns back in front of the model is not.
 * Groq's free tier allows 8,000 tokens per minute, and every tool result rides
 * along in the next request. Six passages of untrimmed handbook prose per search
 * was affordable while the model searched once a turn, and is not now that the
 * system prompt requires grounding before any factual claim.
 *
 * Measured against `qwen/qwen3.8-27b` on Groq: four searches of six untrimmed
 * passages put the following request at 11,362 tokens, well past the ceiling.
 * Groq refused it, and because the tool calls had already streamed, the turn
 * ended with tool calls in it and no answer. Three clipped passages cost roughly
 * a third of that, which keeps several searches inside the budget.
 *
 * This is a mitigation, not the cure. The same model also loops, re-running
 * queries it has already run until the step cap stops it with no step left to
 * answer in. It does that on the pre-hardening prompt too, verified by putting
 * the old prompt back and asking again, so that half of the empty answer lives
 * in the model and not here — clipping only buys the budget back.
 *
 * The clip keeps whole words and marks itself, so a citation is never silently
 * truncated mid-figure, and the section reference travels beside the text either
 * way, so a model that needs the full passage can still point the reader at it.
 */
const MAX_CHUNKS = 3;
const MAX_CHUNK_CHARS = 900;

function clip(text: string): string {
  if (text.length <= MAX_CHUNK_CHARS) return text;
  const cut = text.slice(0, MAX_CHUNK_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length)} […passage truncated]`;
}

export const searchStandardsTool = tool({
  description:
    'Search the humanitarian standards corpus (Sphere Handbook 2018, Core Humanitarian Standard 2024, IASC guidance) for passages relevant to a question. Mandatory before stating any standard, indicator, threshold, minimum figure, commitment, or named principle, and before agreeing with one the user has supplied — including ones you are sure you know, since your recollection may be of a superseded edition. Returns ranked passages with their source and section to cite. An empty result carries a `notice` saying so: it means the corpus does not cover the question, never that you may answer it from memory.',
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'What to look for, in the vocabulary of the standards themselves — e.g. "minimum litres of water per person per day" rather than "how much water".',
      ),
    source: z
      .enum(['sphere', 'chs', 'iasc', 'all'])
      .default('all')
      .describe(
        'Restrict to one publication, or "all" to search the whole corpus. Prefer "all" unless the user named a specific handbook.',
      ),
  }),
  execute: async ({ query, source }) => {
    const result = await searchStandards({ query, source, limit: MAX_CHUNKS });

    return {
      query,
      source,
      chunks: result.chunks.map((chunk) => ({
        ...chunk,
        text: clip(chunk.text),
      })),
      ...(result.notice ? { notice: result.notice } : {}),
    };
  },
});
