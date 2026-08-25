'use client';

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
  if (sources.length === 0) {
    // A notice with no passages is the honest case worth surfacing: the model
    // tried to ground the answer and the corpus had nothing to give it.
    return notice ? (
      <p className="mt-3 rounded-md border border-notice-border bg-notice-soft px-3 py-2 text-xs text-notice">
        {notice}
      </p>
    ) : null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-xs font-medium text-subtle">Sources</span>
      {sources.map((source) => (
        <button
          key={source.key}
          type="button"
          onClick={() => onSelect(source)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-xs text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="font-semibold">{sourceLabel(source.source)}</span>
          <span className="max-w-[18rem] truncate opacity-80 group-hover:opacity-100">
            {source.section}
          </span>
        </button>
      ))}
    </div>
  );
}
