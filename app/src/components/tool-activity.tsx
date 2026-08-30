'use client';

import type { HaiUIMessage } from '@/app/api/chat/route';
import { useLocale } from '@/lib/i18n/context';
import { IconWarning, TOOL_ICONS } from './icons';

type Part = HaiUIMessage['parts'][number];

const KNOWN_TOOLS = ['search_standards', 'crisis_updates', 'humanitarian_data'] as const;
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
 */
export function ToolActivity({ part }: { part: Part }) {
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
    </div>
  );
}
