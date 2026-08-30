'use client';

import type { PlaybookExample } from '@/lib/content';
import { useLocale } from '@/lib/i18n/context';
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
  const { t } = useLocale();
  if (examples.length === 0) return null;

  return (
    <section>
      <h2 className="hai-heading text-[1.05rem] text-foreground">{t.playbookDetail.examplePromptsHeading}</h2>
      <div className="mt-4 space-y-3">
        {examples.map((example) => (
          <div key={example.number} className="border border-border-subtle bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <span className={`hai-eyebrow shrink-0 px-2 py-0.5 ${levelStyle(example.level)}`}>
                {example.level}
              </span>
              <TryInChatButton prompt={example.prompt} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              &ldquo;{example.prompt}&rdquo;
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted italic">
              {t.playbookDetail.whyItWorks} {example.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
