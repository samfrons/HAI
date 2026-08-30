'use client';

import { useLocale } from '@/lib/i18n/context';
import { sourceLabel, type Source } from './sources';

export function Citations({
  sources,
  notice,
  onSelect,
}: {
  sources: Source[];
  notice?: string;
  onSelect: (source: Source) => void;
}) {
  const { t } = useLocale();

  if (sources.length === 0) {
    // A notice with no passages is the honest case worth surfacing: the model
    // tried to ground the answer and the corpus had nothing to give it.
    return notice ? (
      <p className="mt-3 border border-notice-border bg-notice-soft px-3 py-2 text-xs text-notice">
        {notice}
      </p>
    ) : null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="hai-eyebrow me-0.5 text-subtle">{t.citations.sources}</span>
      {sources.map((source, index) => (
        <button
          key={source.key}
          type="button"
          onClick={() => onSelect(source)}
          aria-label={`${sourceLabel(source.source)} — ${source.section}`}
          className="hai-data inline-flex items-center gap-1.5 border border-border-strong px-2 py-1 text-xs text-foreground transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="font-semibold text-accent">[{index + 1}]</span>
          <span>{sourceLabel(source.source)}</span>
        </button>
      ))}
    </div>
  );
}
