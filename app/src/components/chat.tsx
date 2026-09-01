'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { HaiUIMessage } from '@/app/api/chat/route';
import { useLocale } from '@/lib/i18n/context';
import { Citations } from './citations';
import { Composer } from './composer';
import { EmptyState } from './empty-state';
import { HostedModeNotice } from './hosted-mode-notice';
import { IconCoach, IconMark } from './icons';
import { LocaleSwitcher } from './locale-switcher';
import { Markdown } from './markdown';
import { NavLinks } from './nav-links';
import { PendingStatus } from './pending-status';
import { SafetyNotice } from './safety-notice';
import { ShowWorking } from './show-working';
import { SourcePanel } from './source-panel';
import { collectRetrievalNotice, collectSources, type Source } from './sources';
import { ToolActivity } from './tool-activity';

/** Seconds must pass before the elapsed counter appears — see PendingStatus. */
const ELAPSED_THRESHOLD_S = 3;

type MessagePart = HaiUIMessage['parts'][number];

function isToolPart(part: MessagePart): boolean {
  return part.type.startsWith('tool-');
}

function isToolPartDone(part: MessagePart): boolean {
  const state = (part as { state?: string }).state;
  return state === 'output-available' || state === 'output-error';
}

/**
 * What the still-forming assistant turn is doing right now, derived from real
 * stream state rather than a timer — 'contacting' before anything has
 * happened yet, 'writing' once retrieval has finished but no answer text has
 * arrived, and `null` whenever a running tool (rendered by `ToolActivity`) or
 * actual answer text is already the visible feedback.
 */
function pendingPhase(
  status: string,
  lastMessage: HaiUIMessage | undefined,
): 'contacting' | 'writing' | null {
  if (status === 'submitted') return 'contacting';
  if (status !== 'streaming') return null;
  if (!lastMessage || lastMessage.role !== 'assistant') return null;

  const parts = lastMessage.parts;
  if (parts.length === 0) return 'contacting';
  if (parts.some((part) => isToolPart(part) && !isToolPartDone(part))) return null;
  if (parts.some((part) => part.type === 'text' && part.text.length > 0)) return null;
  return 'writing';
}

export function Chat({ hosted = false }: { hosted?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  // "Try in chat" links land here as `/?q=...`. Prefill the composer from it
  // on first render — without sending; the user presses send — via lazy
  // initial state rather than an effect, since this only needs to run once.
  const [input, setInput] = useState(() => searchParams.get('q') ?? '');
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [coachMode, setCoachMode] = useState(false);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat<HaiUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const busy = status === 'submitted' || status === 'streaming';

  // Runs for the whole busy span, not per-phase, so a turn that moves from
  // "contacting" to a tool call to "writing" carries one continuous count —
  // the wait is one wait to the person reading it, however many phases the
  // stream actually goes through.
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  useEffect(() => {
    // Nothing to tear down when the turn finishes: `elapsedLabel` below is
    // gated on `busy` too, so a stale count from the last turn simply never
    // renders until the next one overwrites it from a fresh start time.
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

  const lastMessage = messages[messages.length - 1];
  const phase = pendingPhase(status, lastMessage);
  const elapsedLabel = busy && elapsedSeconds !== null ? t.pending.elapsed(elapsedSeconds) : null;

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  // Drop `q` from the URL once it's been read, so a refresh doesn't
  // re-prefill over whatever the user has typed since.
  useEffect(() => {
    if (searchParams.get('q')) router.replace('/', { scroll: false });
  }, [searchParams, router]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setInput('');
      void sendMessage({ text: trimmed }, { body: { mode: coachMode ? 'coach' : 'default' } });
    },
    [sendMessage, coachMode],
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <IconMark size={14} className="text-accent" />
            <span className="text-base font-bold tracking-tight text-foreground">{t.appName}</span>
            <span className="hidden text-xs text-subtle sm:inline">{t.tagline}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={() => setCoachMode((value) => !value)}
              title={t.coach.tooltip}
              aria-pressed={coachMode}
              className={`hai-eyebrow flex items-center gap-1.5 border px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                coachMode
                  ? 'border-accent text-accent'
                  : 'border-border-strong text-muted hover:text-foreground'
              }`}
            >
              <IconCoach size={13} />
              {t.coach.label}
            </button>
            <NavLinks />
            <LocaleSwitcher />
          </div>
        </div>
        {hosted ? <HostedModeNotice /> : null}
      </header>

      {/* Generous asymmetric margin on wide viewports — a wide empty gutter on
          the start side, Swiss-poster style, with the content column sitting
          right of it rather than centered on the page. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 lg:mx-0 lg:max-w-none lg:grid lg:grid-cols-[minmax(3rem,1fr)_42rem_minmax(2rem,0.6fr)] lg:px-0">
        <div className="lg:col-start-2">
          {messages.length === 0 ? (
            <EmptyState onSelect={send} />
          ) : (
            <div className="space-y-7 py-7">
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1;
                return (
                  <MessageBlock
                    key={message.id}
                    message={message}
                    onSelectSource={setActiveSource}
                    isLast={isLast}
                    pendingPhase={isLast ? phase : null}
                    elapsedLabel={elapsedLabel}
                  />
                );
              })}
              {/* The turn hasn't produced an assistant message yet at all — status
                  'submitted', or 'start' has fired but no parts exist yet. Once the
                  assistant message appears, MessageBlock above takes over. */}
              {phase && lastMessage?.role !== 'assistant' ? (
                <PendingStatus text={t.pending[phase]} elapsedLabel={elapsedLabel} />
              ) : null}
            </div>
          )}

          {error ? (
            <p role="alert" className="my-4 border border-notice-border bg-notice-soft px-4 py-3 text-sm text-notice">
              {error.message || t.errorFallback}
            </p>
          ) : null}

          <div ref={scrollAnchor} />
        </div>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border-subtle bg-background">
        <div className="mx-auto w-full max-w-3xl px-5 pb-4 pt-3 lg:mx-0 lg:max-w-none lg:grid lg:grid-cols-[minmax(3rem,1fr)_42rem_minmax(2rem,0.6fr)] lg:px-0 lg:py-3">
          <div className="lg:col-start-2">
            <Composer value={input} onChange={setInput} onSubmit={() => send(input)} onStop={stop} busy={busy} />
            <p className="mt-2.5 text-center text-xs leading-relaxed text-subtle">{t.disclaimer}</p>
          </div>
        </div>
      </div>

      <SourcePanel source={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
}

function MessageBlock({
  message,
  onSelectSource,
  isLast,
  pendingPhase,
  elapsedLabel,
}: {
  message: HaiUIMessage;
  onSelectSource: (source: Source) => void;
  isLast: boolean;
  /** Meaningful only when `isLast` — see `pendingPhase()` in the parent. */
  pendingPhase: 'contacting' | 'writing' | null;
  elapsedLabel: string | null;
}) {
  const { t } = useLocale();

  if (message.role === 'user') {
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] border-e-2 border-foreground pe-3 text-end">
          <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-foreground">{text}</p>
        </div>
      </div>
    );
  }

  const sources = collectSources(message);
  const notice = collectRetrievalNotice(message);
  const lastPartIndex = message.parts.length - 1;

  return (
    <div className="space-y-2.5">
      {message.parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div key={index} className="text-sm text-foreground">
              <Markdown>{part.text}</Markdown>
            </div>
          );
        }
        if (part.type === 'data-safety-notice') {
          return <SafetyNotice key={index} notice={part.data} />;
        }
        if (part.type.startsWith('tool-')) {
          // Only the turn's currently-running call — the last part of the
          // last message, still in flight — carries the elapsed counter. A
          // finished call, or one from an earlier turn, never shows one. Note
          // this is independent of `pendingPhase`, which is null precisely
          // while a tool is running (see `pendingPhase()` in the parent).
          const isLive = isLast && index === lastPartIndex && !isToolPartDone(part);
          return <ToolActivity key={index} part={part} elapsedLabel={isLive ? elapsedLabel : null} />;
        }
        return null;
      })}

      {pendingPhase === 'writing' ? (
        <PendingStatus text={t.pending.writing} elapsedLabel={elapsedLabel} />
      ) : null}

      <Citations sources={sources} notice={notice} onSelect={onSelectSource} />

      {/* Only once the turn has settled: a disclosure that appears mid-stream
          invites a click onto a list that is still growing underneath it. */}
      {isLast && pendingPhase !== null ? null : <ShowWorking message={message} />}
    </div>
  );
}
