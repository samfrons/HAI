'use client';

import Link from 'next/link';

import type { PlaybookIndexEntry } from '@/lib/content';
import { useLocale } from '@/lib/i18n/context';
import { ContentEnglishNote } from './content-english-note';
import { IconDocument, PLAYBOOK_ICONS } from './icons';

export function PlaybooksIndex({ playbooks }: { playbooks: PlaybookIndexEntry[] }) {
  const { t } = useLocale();

  return (
    <div>
      <h1 className="hai-heading text-xl text-foreground">{t.playbooksPage.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.playbooksPage.description}</p>

      <div className="mt-6">
        <ContentEnglishNote />
        <div className="grid gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((playbook) => {
            const Icon = PLAYBOOK_ICONS[playbook.id] ?? IconDocument;
            return (
              <Link
                key={playbook.id}
                href={`/playbooks/${playbook.id}`}
                className="group flex flex-col bg-background p-5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <Icon size={26} className="text-accent" />
                <span className="mt-3 text-sm font-semibold text-foreground">{playbook.title}</span>
                <span className="hai-eyebrow mt-0.5 text-accent">{playbook.role}</span>
                <span className="mt-2.5 text-sm leading-relaxed text-muted">{playbook.summary}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
