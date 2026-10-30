'use client';

/**
 * The per-message "show working" disclosure in chat.
 *
 * Collapsed by default, and that default is the whole design decision. In the
 * deliverables view the trace is a column of its own because the reader is
 * producing a document they will forward, and provenance is the point. In chat
 * they are mid-conversation and the answer is the point — so the working is one
 * click away rather than in the way, and the row of tool activity above it
 * already tells them grounding happened at all.
 *
 * The rows themselves are `TraceList`, exactly as rendered on the deliverables
 * page, so what "consulted this source" looks like cannot drift between the two
 * surfaces.
 */

import { useMemo, useState } from 'react';

import { traceFromMessage } from '@/lib/agent/chat-trace';
import { useLocale } from '@/lib/i18n/context';
import { TraceList } from './trace-panel';

export function ShowWorking({
  message,
}: {
  message: { parts: ReadonlyArray<{ type: string } & Record<string, unknown>> };
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const events = useMemo(() => traceFromMessage(message), [message]);
  if (events.length === 0) return null;

  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="hai-eyebrow text-subtle transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {open ? t.deliverables.hideWorking : t.deliverables.showWorking}
      </button>

      {open ? (
        <div className="mt-2.5 border-s border-border-subtle ps-3.5">
          <TraceList events={events} />
        </div>
      ) : null}
    </div>
  );
}
