'use client';

import type { HaiUIMessage } from '@/app/api/chat/route';
import { useLocale } from '@/lib/i18n/context';
import { IconWarning, TOOL_ICONS } from './icons';

type Part = HaiUIMessage['parts'][number];

/**
 * Tools this row knows how to describe, keyed by their registry names in
 * `lib/tools/index.ts`. A tool missing from here renders nothing at all — the
 * user watches a silent gap while it runs — so adding a tool to the registry
 * means adding it here, to `TOOL_ICONS`, and to `toolActivity` in the
 * dictionary.
 */
const KNOWN_TOOLS = [
  'search_standards',
  'crisis_updates',
  'humanitarian_data',
  'hazards_context',
] as const;
type KnownTool = (typeof KNOWN_TOOLS)[number];

function toolName(partType: string): KnownTool | undefined {
  const name = partType.replace(/^tool-/, '');
  return (KNOWN_TOOLS as readonly string[]).includes(name) ? (name as KnownTool) : undefined;
}

function detail(part: Part): string | undefined {
  const input = (part as { input?: Record<string, unknown> }).input;
  if (!input) return undefined;

  if (typeof input.query === 'string' && input.query) {
    const country = typeof input.country === 'string' ? input.country : undefined;
    return country ? `${country} — ${input.query}` : input.query;
  }
  // hazards_context, checked before the bare `country_iso3` branch below
  // because it carries that field too — matching on it first would describe a
  // country hazard sweep as "SDN" and drop the part that matters.
  //
  // Which feeds were asked for is worth showing here in a way it is not for the
  // other tools: this is the one call that fans out across four upstream
  // sources, so "GDACS had nothing" and "we never asked GDACS" look identical
  // without it.
  if (input.scope === 'global' || input.scope === 'country') {
    const sources = Array.isArray(input.sources)
      ? input.sources.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const scope = input.scope === 'global' ? 'global' : String(input.country_iso3 ?? 'country');
    return sources.length > 0 ? `${scope} — ${sources.join(', ')}` : scope;
  }
  if (typeof input.country_iso3 === 'string') {
    const dataset =
      typeof input.dataset === 'string' ? input.dataset.replace(/_/g, ' ') : '';
    return `${input.country_iso3}${dataset ? ` — ${dataset}` : ''}`;
  }
  return undefined;
}

/**
 * What each tool says while it is running. Phrased as the work being done, so
 * the reader knows the answer is being grounded rather than composed.
 *
 * `elapsedLabel` is passed only for the turn's currently-live tool call (see
 * `chat.tsx`) — a finished call, or one from an earlier turn, never shows it.
 */
export function ToolActivity({ part, elapsedLabel }: { part: Part; elapsedLabel?: string | null }) {
  const { t } = useLocale();
  const tool = toolName(part.type);
  if (!tool) return null;

  const state = (part as { state?: string }).state;
  const isDone = state === 'output-available' || state === 'output-error';
  const failed = state === 'output-error';
  const text = failed
    ? t.toolActivity.failed
    : isDone
      ? t.toolActivity.done[tool]
      : t.toolActivity.running[tool];
  const context = detail(part);
  const ToolIcon = TOOL_ICONS[tool];

  return (
    <div
      className="flex items-center gap-2 text-xs text-subtle"
      aria-live={isDone ? 'off' : 'polite'}
    >
      {failed ? (
        <IconWarning size={14} className="shrink-0 text-notice" />
      ) : (
        <ToolIcon size={14} className={`shrink-0 ${isDone ? 'text-subtle' : 'text-accent hai-pulse'}`} />
      )}
      <span>
        {text}
        {context ? <span className="text-subtle/70"> · {context}</span> : null}
        {isDone ? null : <span className="hai-pulse">…</span>}
      </span>
      {!isDone && elapsedLabel ? <span className="hai-data text-subtle/70">{elapsedLabel}</span> : null}
    </div>
  );
}
