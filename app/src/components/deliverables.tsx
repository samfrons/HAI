'use client';

/**
 * The deliverables surface: pick a template, name a subject, watch a document
 * assemble beside an account of how it was assembled.
 *
 * The two-column layout is the argument the whole feature makes. A generated
 * humanitarian brief with no visible working is an artefact nobody should
 * forward — the figures look identical whether they were retrieved or invented.
 * Putting the trace next to the prose, at the same weight, means the reader
 * never has to go looking for the provenance; it is already on screen, ticking,
 * while the section it belongs to is being written.
 */

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DeliverableUIMessage } from '@/app/api/deliverables/route';
import { assembleDocument, documentFilename, foldRun } from '@/lib/agent/render';
import type { TraceEvent } from '@/lib/agent/types';
import { WORKFLOWS, WORKFLOW_IDS, type WorkflowId } from '@/lib/agent/workflows';
import { useLocale } from '@/lib/i18n/context';
import { IconCheck, IconCopy, IconDeliverable, IconDownload, IconWarning } from './icons';
import { Markdown } from './markdown';
import { PendingStatus } from './pending-status';
import { TracePanel } from './trace-panel';

/** Seconds before the elapsed counter appears — matches the chat's threshold. */
const ELAPSED_THRESHOLD_S = 3;

/** Trace events out of the run's single assistant message. */
function traceEvents(message: DeliverableUIMessage | undefined): TraceEvent[] {
  if (!message) return [];
  return message.parts
    .filter((part): part is { type: 'data-trace'; data: TraceEvent } => part.type === 'data-trace')
    .map((part) => part.data);
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

export function Deliverables() {
  const { t } = useLocale();
  const d = t.deliverables;

  const [templateId, setTemplateId] = useState<WorkflowId>('situation-brief');
  const [subject, setSubject] = useState('');
  const [started, setStarted] = useState(false);

  const { messages, sendMessage, status, stop, error, setMessages } =
    useChat<DeliverableUIMessage>({
      transport: new DefaultChatTransport({
        api: '/api/deliverables',
        // The route takes a template and a subject, not a message history: a
        // run is not a conversation, and shipping the whole `messages` array
        // would send the server a shape it has no use for.
        prepareSendMessagesRequest: ({ messages: sent, body }) => ({
          body: {
            workflowId: body?.workflowId,
            subject: sent
              .at(-1)
              ?.parts.filter((part) => part.type === 'text')
              .map((part) => part.text)
              .join(' ')
              .trim(),
          },
        }),
      }),
    });

  const busy = status === 'submitted' || status === 'streaming';
  const events = useMemo(
    () => traceEvents(messages.find((message) => message.role === 'assistant')),
    [messages],
  );

  const template = WORKFLOWS[templateId];
  const run = useMemo(() => foldRun(events, template.title), [events, template.title]);

  // One continuous count for the whole run, as in chat: a wait that moves
  // through six sections is still one wait to the person watching it.
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const tick = () => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(seconds >= ELAPSED_THRESHOLD_S ? seconds : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [busy]);

  const elapsedLabel = busy && elapsedSeconds !== null ? t.pending.elapsed(elapsedSeconds) : null;

  const start = useCallback(() => {
    const trimmed = subject.trim();
    if (!trimmed || busy) return;
    setStarted(true);
    void sendMessage({ text: trimmed }, { body: { workflowId: templateId } });
  }, [subject, busy, sendMessage, templateId]);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setStarted(false);
  }, [stop, setMessages]);

  if (!started) {
    return (
      <Setup
        templateId={templateId}
        onTemplate={setTemplateId}
        subject={subject}
        onSubject={setSubject}
        onStart={start}
      />
    );
  }

  const markdown = assembleDocument(run.title, run.sections);
  const hasContent = run.sections.some((section) => section.markdown.trim());
  // Stopped, errored, or the stream ended without the run saying it finished —
  // the serverless timeout looks exactly like the last of those from here.
  const partial = !busy && !run.finished && hasContent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-xl text-foreground">{run.title}</h1>
          <p className="hai-eyebrow mt-1 text-subtle">{d.templates[templateId].name}</p>
        </div>
        <div className="flex items-center gap-2">
          {busy ? (
            <button type="button" onClick={stop} className={buttonClass}>
              {d.stop}
            </button>
          ) : (
            <button type="button" onClick={reset} className={buttonClass}>
              {d.reset}
            </button>
          )}
          <ExportButtons markdown={markdown} title={run.title} disabled={!hasContent} />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="border border-notice-border bg-notice-soft px-4 py-3 text-sm text-notice"
        >
          {error.message || t.errorFallback}
        </p>
      ) : null}

      {/* Document left, working right — on a narrow screen the trace drops
          below the document rather than beside it, since the document is what
          someone on a phone came for. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <section aria-label={d.documentHeading} className="min-w-0 space-y-4">
          {run.failed ? (
            <Banner tone="notice">{run.failed}</Banner>
          ) : partial ? (
            <Banner tone="notice">{d.partialNotice}</Banner>
          ) : null}

          {run.flagged > 0 ? (
            <Banner tone="accent">{d.flaggedNotice(run.flagged)}</Banner>
          ) : null}

          {hasContent ? (
            <article className="space-y-6">
              {run.sections.map((section) =>
                section.markdown.trim() ? (
                  <div key={section.id} className="space-y-2">
                    <h2 className="hai-eyebrow border-b border-border-subtle pb-1.5 text-subtle">
                      {section.heading}
                    </h2>
                    <div className="text-sm text-foreground">
                      <Markdown>{section.markdown}</Markdown>
                    </div>
                  </div>
                ) : null,
              )}
            </article>
          ) : (
            <p className="text-sm text-subtle">{d.documentEmpty}</p>
          )}

          {busy ? (
            <PendingStatus
              text={events.length === 0 ? t.pending.contacting : d.generating}
              elapsedLabel={elapsedLabel}
            />
          ) : null}
        </section>

        <div className="lg:border-s lg:border-border-subtle lg:ps-8">
          <TracePanel events={events} busy={busy} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------ */

function Setup({
  templateId,
  onTemplate,
  subject,
  onSubject,
  onStart,
}: {
  templateId: WorkflowId;
  onTemplate: (id: WorkflowId) => void;
  subject: string;
  onSubject: (value: string) => void;
  onStart: () => void;
}) {
  const { t } = useLocale();
  const d = t.deliverables;
  const kind = WORKFLOWS[templateId].subjectKind;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl text-foreground">{d.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{d.description}</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="hai-eyebrow mb-3 text-subtle">{d.templateHeading}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKFLOW_IDS.map((id) => {
            const selected = id === templateId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTemplate(id)}
                aria-pressed={selected}
                className={`flex h-full flex-col gap-2 border p-4 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected
                    ? 'border-accent'
                    : 'border-border-subtle hover:border-border-strong'
                }`}
              >
                <IconDeliverable
                  size={18}
                  className={selected ? 'text-accent' : 'text-subtle'}
                />
                <span className="text-sm font-semibold text-foreground">
                  {d.templates[id].name}
                </span>
                <span className="text-xs leading-relaxed text-subtle">
                  {d.templates[id].description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onStart();
        }}
      >
        <label htmlFor="deliverable-subject" className="hai-eyebrow block text-subtle">
          {kind === 'country' ? d.subjectLabelCountry : d.subjectLabelTopic}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="deliverable-subject"
            value={subject}
            onChange={(event) => onSubject(event.target.value)}
            placeholder={
              kind === 'country' ? d.subjectPlaceholderCountry : d.subjectPlaceholderTopic
            }
            maxLength={120}
            className="min-w-0 flex-1 border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!subject.trim()}
            className="border border-accent bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {d.generate}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-subtle">{t.disclaimer}</p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

const buttonClass =
  'hai-eyebrow border border-border-strong px-2.5 py-1 text-muted transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Copy and download, both entirely client-side.
 *
 * The markdown is already in the browser — it was assembled from the trace
 * there — so a round trip to ask the server for it again would be a second code
 * path producing a second version of the same document. A blob URL keeps the
 * export exactly equal to what is on screen.
 */
function ExportButtons({
  markdown,
  title,
  disabled,
}: {
  markdown: string;
  title: string;
  disabled: boolean;
}) {
  const { t } = useLocale();
  const d = t.deliverables;
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some browsers and every insecure
      // context. Download still works, so there is no need to alarm anyone.
    }
  }, [markdown]);

  const download = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = documentFilename(title);
    anchor.click();
    URL.revokeObjectURL(url);
  }, [markdown, title]);

  return (
    <>
      <button type="button" onClick={copy} disabled={disabled} className={buttonClass}>
        <span className="flex items-center gap-1.5">
          {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
          {copied ? d.copied : d.copy}
        </span>
      </button>
      <button type="button" onClick={download} disabled={disabled} className={buttonClass}>
        <span className="flex items-center gap-1.5">
          <IconDownload size={12} />
          {d.download}
        </span>
      </button>
    </>
  );
}

function Banner({ tone, children }: { tone: 'notice' | 'accent'; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={`flex items-start gap-2 border px-3.5 py-2.5 text-xs leading-relaxed ${
        tone === 'accent'
          ? 'border-accent-border bg-accent-soft text-foreground'
          : 'border-notice-border bg-notice-soft text-notice'
      }`}
    >
      <IconWarning
        size={14}
        className={`mt-0.5 shrink-0 ${tone === 'accent' ? 'text-accent' : 'text-notice'}`}
      />
      <span>{children}</span>
    </p>
  );
}
