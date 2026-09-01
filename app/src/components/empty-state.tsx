'use client';

import { useLocale } from '@/lib/i18n/context';

export function EmptyState({ onSelect }: { onSelect: (prompt: string) => void }) {
  const { t } = useLocale();

  return (
    <div className="flex max-w-2xl flex-col items-start py-10">
      <h1 className="hai-heading text-2xl leading-[1.1] text-foreground sm:text-3xl">
        {t.emptyState.heading}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{t.emptyState.body}</p>

      <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-border-subtle py-3">
        {t.emptyState.factsStrip.map((fact) => (
          <dd key={fact} className="hai-data text-xs text-foreground">
            {fact}
          </dd>
        ))}
      </dl>

      <ul className="mt-6 space-y-1.5">
        {t.emptyState.whatHaiDoes.map((line) => (
          <li key={line} className="flex items-baseline gap-2 text-sm text-foreground">
            <span aria-hidden="true" className="text-accent">
              —
            </span>
            {line}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-subtle">{t.emptyState.limitsLine}</p>

      <div className="mt-8 grid w-full gap-px bg-border-subtle sm:grid-cols-2">
        {t.emptyState.suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => onSelect(suggestion.prompt)}
            className="group bg-background px-4 py-3.5 text-start transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          >
            <span className="hai-eyebrow text-accent">{suggestion.title}</span>
            <span className="mt-1.5 block text-sm leading-snug text-foreground">
              {suggestion.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
