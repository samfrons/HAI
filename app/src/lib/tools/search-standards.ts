import { tool } from 'ai';
import { z } from 'zod';

import { searchStandards } from '@/lib/retrieval/search';

// cost: free — local retrieval over the ingested corpus, no third-party call.

export const searchStandardsTool = tool({
  description:
    'Search the humanitarian standards corpus (Sphere Handbook 2018, Core Humanitarian Standard 2024, IASC guidance) for passages relevant to a question. Call this before stating any standard, indicator, threshold, minimum figure, or commitment — including ones you believe you know. Returns ranked passages with their source and section for citation.',
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
    const result = await searchStandards({ query, source, limit: 6 });

    return {
      query,
      source,
      chunks: result.chunks,
      ...(result.notice ? { notice: result.notice } : {}),
    };
  },
});
