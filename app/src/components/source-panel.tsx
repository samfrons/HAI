'use client';

import { useEffect, useRef } from 'react';

import { useLocale } from '@/lib/i18n/context';
import { sourceLabel, type Source } from './sources';

export function SourcePanel({
  source,
  onClose,
}: {
  source: Source | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!source) return;

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [source, onClose]);

  if (!source) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label={t.sourcePanel.closePanel}
        onClick={onClose}
        className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${sourceLabel(source.source)} — ${source.section}`}
        className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-border-subtle bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          {/* The excerpt itself — label, section breadcrumb, and body — is the
              English source corpus, not UI chrome, so it stays LTR and
              left-aligned regardless of the active locale's direction. */}
          <div dir="ltr" className="min-w-0 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {sourceLabel(source.source)}
            </p>
            <h2 className="mt-1 text-sm font-semibold leading-snug text-foreground">
              {source.section}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="-me-1 shrink-0 rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t.sourcePanel.close}
          </button>
        </header>

        <div dir="ltr" className="flex-1 overflow-y-auto px-5 py-4 text-left">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {source.text}
          </p>
        </div>

        <footer className="border-t border-border-subtle px-5 py-3 text-xs text-subtle">
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {t.sourcePanel.openFullText}
            </a>
          ) : (
            <span>{t.sourcePanel.verifyText}</span>
          )}
        </footer>
      </aside>
    </div>
  );
}
