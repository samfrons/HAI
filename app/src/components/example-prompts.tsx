import type { PlaybookExample } from '@/lib/content';
import { TryInChatButton } from './try-in-chat-button';

const LEVEL_STYLES: Record<string, string> = {
  beginner: 'text-accent bg-accent-soft',
  intermediate: 'text-notice bg-notice-soft',
  advanced: 'text-foreground bg-surface-muted',
};

function levelStyle(level: string): string {
  return LEVEL_STYLES[level.toLowerCase()] ?? 'text-muted bg-surface-muted';
}

export function ExamplePrompts({ examples }: { examples: PlaybookExample[] }) {
  if (examples.length === 0) return null;

  return (
    <section>
      <h2 className="text-[1.05rem] font-semibold tracking-tight text-foreground">
        Example prompts
      </h2>
      <div className="mt-4 space-y-3">
        {examples.map((example) => (
          <div
            key={example.number}
            className="rounded-lg border border-border-subtle bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${levelStyle(
                  example.level,
                )}`}
              >
                {example.level}
              </span>
              <TryInChatButton prompt={example.prompt} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              &ldquo;{example.prompt}&rdquo;
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted italic">
              Why it works: {example.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
