'use client';

/**
 * The four examples are chosen to show the four things HAI does differently:
 * a sourced standards lookup, a live-data lookup, a data-responsibility
 * refusal, and a CHS commitment question.
 */
const SUGGESTIONS = [
  {
    title: 'Sphere minimum standards',
    prompt:
      'What are the Sphere minimum standards for water supply per person per day?',
  },
  {
    title: 'Live situation reports',
    prompt: 'What are the latest situation reports for Sudan?',
  },
  {
    title: 'Data responsibility',
    prompt: 'How should we handle beneficiary data collected at intake?',
  },
  {
    title: 'Accountability to affected people',
    prompt: 'What are the CHS commitments on accountability to affected people?',
  },
];

export function EmptyState({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-1 py-10">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Humanitarian standards, grounded and cited.
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        HAI answers from the Sphere Handbook, the Core Humanitarian Standard, and
        IASC guidance, and pulls live figures for active crises. It cites what it
        retrieves so you can check it against the handbook.
      </p>

      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => onSelect(suggestion.prompt)}
            className="group rounded-lg border border-border-subtle bg-surface px-4 py-3 text-left transition-colors hover:border-accent-border hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
