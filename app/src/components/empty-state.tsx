'use client';

import { useLocale } from '@/lib/i18n/context';

export function EmptyState({ onSelect }: { onSelect: (prompt: string) => void }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-1 py-10">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {t.emptyState.heading}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t.emptyState.body}</p>

      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {t.emptyState.suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => onSelect(suggestion.prompt)}
            className="group rounded-lg border border-border-subtle bg-surface px-4 py-3 text-start transition-colors hover:border-accent-border hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block text-xs font-semibold uppercase tracking-wider text-accent">
              {suggestion.title}
            </span>
            <span className="mt-1.5 block text-sm leading-snug text-foreground">
              {suggestion.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
