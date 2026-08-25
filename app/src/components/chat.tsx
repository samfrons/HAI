'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import type { HaiUIMessage } from '@/app/api/chat/route';
import { Citations } from './citations';
import { Composer } from './composer';
import { EmptyState } from './empty-state';
import { Markdown } from './markdown';
import { NavLinks } from './nav-links';
import { SafetyNotice } from './safety-notice';
import { SourcePanel } from './source-panel';
import { collectRetrievalNotice, collectSources, type Source } from './sources';
import { ToolActivity } from './tool-activity';

export function Chat() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold tracking-tight text-foreground">
              HAI
            </span>
            <span className="hidden text-xs text-subtle sm:inline">
              Humanitarian operations assistant
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCoachMode((value) => !value)}
              title="Coach mode: before answering, HAI briefly points out one strength and one improvement to your prompt, then answers the improved version."
              aria-pressed={coachMode}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                coachMode
                  ? 'border-accent-border bg-accent-soft text-accent'
                  : 'border-border-subtle text-muted hover:text-foreground'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                  coachMode ? 'border-accent bg-accent' : 'border-border-strong bg-transparent'
                }`}
              />
              Coach mode
            </button>
            <NavLinks />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5">
        {messages.length === 0 ? (
          <EmptyState onSelect={send} />
        ) : (
          <div className="space-y-7 py-7">
            {messages.map((message) => (
              <MessageBlock
                key={message.id}
                message={message}
                onSelectSource={setActiveSource}
              />
            ))}
          </div>
        )}

        {error ? (
          <p
            role="alert"
            className="my-4 rounded-lg border border-notice-border bg-notice-soft px-4 py-3 text-sm text-notice"
          >
            {error.message ||
              'The assistant could not complete that request. Try again.'}
          </p>
        ) : null}

        <div ref={scrollAnchor} />
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border-subtle bg-background/85 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-5 pb-4 pt-3">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            onStop={stop}
            busy={busy}
          />
          <p className="mt-2.5 text-center text-xs leading-relaxed text-subtle">
            HAI provides guidance grounded in humanitarian standards. It does not
            replace professional judgment.
          </p>
        </div>
      </div>

      <SourcePanel source={activeSource} onClose={() => setActiveSource(null)} />
    </div>
  );
}

function MessageBlock({
  message,
  onSelectSource,
}: {
  message: HaiUIMessage;
  onSelectSource: (source: Source) => void;
}) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm leading-relaxed text-white">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  const sources = collectSources(message);
  const notice = collectRetrievalNotice(message);

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
          return <ToolActivity key={index} part={part} />;
        }
        return null;
      })}

      <Citations sources={sources} notice={notice} onSelect={onSelectSource} />
    </div>
  );
}
