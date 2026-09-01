'use client';

/**
 * The trace panel: what the machine did, in the order it did it.
 *
 * This is not a debug view that happened to get shipped. For a humanitarian
 * deliverable the working *is* part of the product — an analyst who cannot see
 * which source a figure came from, or that the funding section ran while the
 * funding API was down, cannot responsibly forward the document. So the panel
 * is written for that reader rather than for an engineer: tool calls read as
 * sources consulted, verification reads as claims checked, and a failure reads
 * as a named source that did not answer.
 *
 * Two exported surfaces. `TracePanel` is the full right-hand column of the
 * deliverables run view. `TraceList` is the same event rendering without the
 * plan checklist or the frame, which the chat's per-message "show working"
 * disclosure reuses so the two views can never drift apart.
 */

import { useEffect, useMemo, useState } from 'react';

import { useLocale } from '@/lib/i18n/context';
import type { PlannedSection, TraceEvent, Verdict } from '@/lib/agent/types';
import { IconCheck, IconFlag, IconMark, IconWarning, toolIcon } from './icons';

/* ------------------------------------------------------------------ *
 * Plan checklist
 * ------------------------------------------------------------------ */

type SectionStatus = 'pending' | 'active' | 'done' | 'flagged';

/**
 * Where each planned section has got to, derived from the events rather than
 * tracked separately — there is one source of truth for a run, and it is the
 * event stream.
 */
export function sectionStatuses(events: TraceEvent[]): Map<string, SectionStatus> {
  const statuses = new Map<string, SectionStatus>();

  for (const event of events) {
    if (event.type === 'plan-created') {
      for (const section of event.sections) statuses.set(section.id, 'pending');
    } else if (event.type === 'step-started' && event.sectionId) {
      if (statuses.get(event.sectionId) !== 'done') statuses.set(event.sectionId, 'active');
    } else if (event.type === 'draft-section') {
      statuses.set(event.sectionId, 'done');
    } else if (event.type === 'section-verified') {
      statuses.set(event.sectionId, event.flagged > 0 ? 'flagged' : 'done');
    }
  }

  return statuses;
}

function PlanChecklist({
  sections,
  statuses,
}: {
  sections: PlannedSection[];
  statuses: Map<string, SectionStatus>;
}) {
  const { t } = useLocale();

  return (
    <ol className="space-y-1.5">
      {sections.map((section, index) => {
        const status = statuses.get(section.id) ?? 'pending';
        return (
          <li key={section.id} className="flex items-baseline gap-2 text-xs">
            <span className="hai-data w-5 shrink-0 text-subtle/70">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className={
                status === 'pending'
                  ? 'text-subtle'
                  : status === 'active'
                    ? 'text-foreground'
                    : 'text-muted'
              }
            >
              {section.heading}
            </span>
            <span className="ms-auto shrink-0">
              {status === 'active' ? (
                <IconMark size={7} className="text-accent hai-pulse" />
              ) : status === 'flagged' ? (
                <IconFlag size={12} className="text-accent" aria-label={t.deliverables.hasFlags} />
              ) : status === 'done' ? (
                <IconCheck size={12} className="text-subtle" />
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * Event rows
 * ------------------------------------------------------------------ */

const VERDICT_TONE: Record<Verdict, string> = {
  supported: 'text-subtle',
  unsupported: 'text-accent',
  unverifiable: 'text-accent',
};

/**
 * One event as a line the reader can act on.
 *
 * Returning `null` is normal and intended: `draft-delta` fires hundreds of
 * times a run and belongs in the document, not the log, and `step-finished`
 * only says anything when the step degraded. A panel that rendered every event
 * would be unreadable at exactly the moment someone needs to read it.
 */
function TraceRow({ event }: { event: TraceEvent }) {
  const { t } = useLocale();
  const d = t.deliverables;

  switch (event.type) {
    case 'step-started':
      return (
        <Row tone="heading">
          <span className="hai-eyebrow text-subtle">{d.steps[event.kind]}</span>
          <span className="text-muted"> {event.label}</span>
        </Row>
      );

    case 'tool-called':
      return (
        <Row icon={renderToolIcon(event.tool)}>
          <span className="hai-data text-muted">{event.tool}</span>
          {event.args ? <span className="hai-data text-subtle/80"> {event.args}</span> : null}
        </Row>
      );

    case 'tool-result':
      return (
        <Row
          icon={
            event.ok ? (
              <IconCheck size={13} className="text-subtle" />
            ) : (
              <IconWarning size={13} className="text-notice" />
            )
          }
        >
          <span className={event.ok ? 'text-subtle' : 'text-notice'}>{event.summary}</span>
        </Row>
      );

    case 'check-run':
      return (
        <Row
          icon={
            event.verdict === 'supported' ? (
              <IconCheck size={13} className="text-subtle" />
            ) : (
              <IconFlag size={13} className="text-accent" />
            )
          }
        >
          <span className={`hai-eyebrow ${VERDICT_TONE[event.verdict]}`}>
            {d.verdicts[event.verdict]}
          </span>
          <span className="text-subtle"> {truncate(event.claim, 110)}</span>
          {event.source ? (
            <span className="hai-data text-subtle/70"> · {event.source}</span>
          ) : null}
        </Row>
      );

    case 'source-error':
      return (
        <Row icon={<IconWarning size={13} className="text-notice" />}>
          <span className="hai-data text-notice">{event.source}</span>
          <span className="text-subtle"> {truncate(event.message, 140)}</span>
        </Row>
      );

    case 'step-finished':
      if (event.ok || !event.note) return null;
      return (
        <Row icon={<IconWarning size={13} className="text-notice" />}>
          <span className="text-subtle">{truncate(event.note, 140)}</span>
        </Row>
      );

    case 'budget-wait':
      // The per-minute wait is rendered live by `TraceList` from the tail of
      // the stream, not here: once it is over there is nothing left to say,
      // and a row frozen at "resumes in 44s" would be a lie about the past.
      // The per-day one is not a wait at all — it is where the run ended —
      // so it stays in the log where the reader can still see it.
      if (event.scope !== 'tokens-per-day') return null;
      return (
        <Row icon={<IconWarning size={13} className="text-notice" />}>
          <span className="text-notice">{d.budgetDailyExhausted}</span>
        </Row>
      );

    case 'workflow-error':
      return (
        <Row icon={<IconWarning size={13} className="text-notice" />}>
          <span className="text-notice">{event.message}</span>
        </Row>
      );

    case 'workflow-done':
      return (
        <Row tone="heading">
          <span className="hai-eyebrow text-subtle">
            {event.flagged > 0 ? d.doneWithFlags(event.flagged) : d.done}
          </span>
        </Row>
      );

    default:
      return null;
  }
}

/**
 * Resolved outside the component body on purpose: `toolIcon` looks a name up in
 * the registry at call time, and binding its result to a capitalised local
 * inside a render reads to React's lint rules as defining a component per
 * render. The glyph still varies by tool, which is the point — the trace shows
 * whatever the registry holds, including tools added after this was written.
 */
function renderToolIcon(name: string) {
  const Icon = toolIcon(name);
  return <Icon size={13} className="text-subtle" />;
}

function Row({
  icon,
  tone,
  children,
}: {
  icon?: React.ReactNode;
  tone?: 'heading';
  children: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-baseline gap-2 text-xs leading-relaxed ${
        tone === 'heading' ? 'pt-2.5 first:pt-0' : ''
      }`}
    >
      <span className="mt-0.5 w-3.5 shrink-0 self-start">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * The pacing row
 * ------------------------------------------------------------------ */

type BudgetWait = Extract<TraceEvent, { type: 'budget-wait' }>;

/**
 * The per-minute wait the run is inside *right now*, or null.
 *
 * "Right now" is exactly the tail of the stream: the engine emits nothing
 * between a `budget-wait` and the `budget-resumed` that ends it, so a wait that
 * is still the last event is a wait still being served, and any event after it
 * — the resume, the step that followed, the workflow error after a daily wall —
 * has already cleared it.
 */
function activeBudgetWait(events: TraceEvent[]): BudgetWait | null {
  const last = events[events.length - 1];
  if (!last || last.type !== 'budget-wait') return null;
  return last.scope === 'tokens-per-minute' ? last : null;
}

/**
 * A wait, named and counted down.
 *
 * The count is a one-second interval rather than a re-render of the whole
 * panel: only this row's number changes, and the trace above it must not
 * reflow once a second while somebody is reading it.
 *
 * The deadline is anchored to when this row mounted plus `waitMs`, not to
 * `event.at + waitMs`, because `at` is the *server's* clock and this subtraction
 * would otherwise be as wrong as the difference between the two machines — a
 * browser thirty seconds behind would show a countdown that never ends. The
 * event arrives over an open stream within milliseconds of being emitted, so
 * mount time is the better anchor by a wide margin.
 *
 * Deliberately still: a muted, unpulsed mark. The pulse in this design means
 * "work is happening here", and no work is happening here.
 */
function BudgetWaitRow({ event }: { event: BudgetWait }) {
  const { t } = useLocale();
  const [remaining, setRemaining] = useState(() => Math.ceil(event.waitMs / 1000));

  useEffect(() => {
    const deadline = Date.now() + event.waitMs;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event.waitMs]);

  return (
    <Row icon={<IconMark size={7} className="text-subtle/60" />}>
      <span className="text-subtle">{t.deliverables.budgetWaiting}</span>
      {/* Hidden from assistive tech: the sentence beside it is the message,
          and a number that changes every second inside the panel's polite
          live region would talk over everything else the run has to say. */}
      <span className="hai-data text-subtle/70" aria-hidden="true">
        {' · '}
        {t.deliverables.budgetResumesIn(remaining)}
      </span>
    </Row>
  );
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`;
}

/* ------------------------------------------------------------------ *
 * Exported surfaces
 * ------------------------------------------------------------------ */

/** The event log alone — reused by the chat's "show working" disclosure. */
export function TraceList({ events }: { events: TraceEvent[] }) {
  const { t } = useLocale();
  const wait = activeBudgetWait(events);

  if (events.length === 0) {
    return <p className="text-xs text-subtle">{t.deliverables.traceEmpty}</p>;
  }

  return (
    <ul className="space-y-1">
      {events.map((event, index) => (
        <TraceRow key={`${event.type}-${event.at}-${index}`} event={event} />
      ))}
      {/* Keyed by the wait it belongs to, so a second wait gets a second row
          with a freshly anchored countdown rather than inheriting the first's. */}
      {wait ? <BudgetWaitRow key={`wait-${wait.at}`} event={wait} /> : null}
    </ul>
  );
}

/** The full right-hand column: the plan, then the log. */
export function TracePanel({ events, busy }: { events: TraceEvent[]; busy: boolean }) {
  const { t } = useLocale();
  const d = t.deliverables;

  const plan = useMemo(
    () => events.find((event) => event.type === 'plan-created'),
    [events],
  );
  const statuses = useMemo(() => sectionStatuses(events), [events]);

  return (
    <aside className="space-y-5" aria-label={d.traceHeading}>
      <div>
        <h2 className="hai-eyebrow mb-2.5 text-subtle">{d.traceHeading}</h2>
        <p className="text-xs leading-relaxed text-subtle">{d.traceExplainer}</p>
      </div>

      {plan ? (
        <div className="border-t border-border-subtle pt-3.5">
          <h3 className="hai-eyebrow mb-2.5 text-subtle">{d.planHeading}</h3>
          <PlanChecklist sections={plan.sections} statuses={statuses} />
        </div>
      ) : null}

      <div
        className="border-t border-border-subtle pt-3.5"
        aria-live="polite"
        aria-busy={busy}
      >
        <TraceList events={events} />
      </div>
    </aside>
  );
}
