'use client';

import Link from 'next/link';

import type { GuideIndexEntry } from '@/lib/content';
import { useLocale } from '@/lib/i18n/context';
import { ContentEnglishNote } from './content-english-note';

export function GuidesIndex({ guides }: { guides: GuideIndexEntry[] }) {
  const { t } = useLocale();

  return (
    <div>
      <h1 className="hai-heading text-xl text-foreground">{t.guidesPage.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.guidesPage.description}</p>

      <div className="mt-6">
        <ContentEnglishNote />
        <div className="grid gap-px bg-border-subtle sm:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.id}
              href={`/guides/${guide.id}`}
              className="group flex flex-col bg-background p-5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              <span className="text-sm font-semibold text-foreground">{guide.title}</span>
              <span className="mt-2.5 text-sm leading-relaxed text-muted">{guide.summary}</span>
            </Link>
          ))}
          {/* An odd guide count leaves the last grid cell empty, which would
              otherwise show the hairline-divider colour as a solid block —
              a plain background-coloured filler keeps that cell invisible. */}
          {guides.length % 2 === 1 ? <div className="hidden bg-background sm:block" /> : null}
        </div>
      </div>
    </div>
  );
}
