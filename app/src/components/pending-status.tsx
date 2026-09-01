'use client';

import { IconMark } from './icons';

/**
 * The instant, felt-speed signal shown the moment a message is sent, and
 * through every silent gap afterwards — before the model has said anything,
 * and again between a finished tool call and the first word of the answer.
 * Swiss-plain on purpose: a pulsing solid square (the wordmark's own mark,
 * not a borrowed spinner) and a status line that changes as real stream
 * events arrive, never an animation that implies more than "still working".
 */
export function PendingStatus({
  text,
  elapsedLabel,
}: {
  text: string;
  /** Pre-formatted via `t.pending.elapsed(seconds)`; omitted under ~3s. */
  elapsedLabel?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-subtle" role="status" aria-live="polite">
      <IconMark size={8} className="shrink-0 text-accent hai-pulse" />
      <span>{text}</span>
      {elapsedLabel ? <span className="hai-data text-subtle/70">{elapsedLabel}</span> : null}
    </div>
  );
}
