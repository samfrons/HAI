'use client';

import Link from 'next/link';

import type { GuideIndexEntry } from '@/lib/content';
import { useLocale } from '@/lib/i18n/context';
import { ContentEnglishNote } from './content-english-note';

export function GuidesIndex({ guides }: { guides: GuideIndexEntry[] }) {
  const { t } = useLocale();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t.guidesPage.title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {t.guidesPage.description}
      </p>

      <div className="mt-6">
        <ContentEnglishNote />
        <div className="grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.id}
              href={`/guides/${guide.id}`}
              className="group flex flex-col rounded-xl border border-border-subtle bg-surface p-5 transition-colors hover:border-accent-border hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="text-sm font-semibold text-foreground">{guide.title}</span>
              <span className="mt-2.5 text-sm leading-relaxed text-muted">{guide.summary}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
