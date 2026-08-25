'use client';

import Link from 'next/link';

import type { Playbook } from '@/lib/content';
import { useLocale } from '@/lib/i18n/context';
import { ContentEnglishNote } from './content-english-note';
import { ExamplePrompts } from './example-prompts';
import { Markdown } from './markdown';

export function PlaybookDetail({ playbook }: { playbook: Playbook }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/playbooks"
        className="text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden="true" className="rtl:-scale-x-100">
          ←
        </span>{' '}
        {t.playbookDetail.backLink}
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {playbook.icon}
        </span>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          {playbook.role}
        </span>
      </div>

      <div className="mt-6">
        <ContentEnglishNote />
        <Markdown>{playbook.intro}</Markdown>
      </div>

      <div className="mt-8">
        <ExamplePrompts examples={playbook.examples} />
      </div>

      <div className="mt-8">
        <Markdown>{playbook.outro}</Markdown>
      </div>
    </div>
  );
}
