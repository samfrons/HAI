import type { StandardsChunk } from '@/lib/retrieval/search';
import type { HaiUIMessage } from '@/app/api/chat/route';

/** A retrieved passage, tagged with the message it was cited in. */
export interface Source extends StandardsChunk {
  key: string;
}

const SOURCE_LABELS: Record<string, string> = {
  sphere: 'Sphere',
  chs: 'CHS',
  iasc: 'IASC',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.toUpperCase();
}

interface StandardsOutput {
  chunks?: StandardsChunk[];
  notice?: string;
}

/**
 * Pull the retrieved passages out of a message's search_standards results.
 * Deduplicated by chunk id — the model often searches more than once in a
 * single answer and lands on overlapping passages.
 */
export function collectSources(message: HaiUIMessage): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];

  for (const part of message.parts) {
    if (part.type !== 'tool-search_standards') continue;
    if (part.state !== 'output-available') continue;

    const output = part.output as StandardsOutput | undefined;
    for (const chunk of output?.chunks ?? []) {
      if (seen.has(chunk.id)) continue;
      seen.add(chunk.id);
      sources.push({ ...chunk, key: `${message.id}-${chunk.id}` });
    }
  }

  return sources;
}

/** The notice a stubbed or degraded retrieval attaches to its result, if any. */
export function collectRetrievalNotice(message: HaiUIMessage): string | undefined {
  for (const part of message.parts) {
    if (part.type !== 'tool-search_standards') continue;
    if (part.state !== 'output-available') continue;
    const output = part.output as StandardsOutput | undefined;
    if (output?.notice) return output.notice;
  }
  return undefined;
}
