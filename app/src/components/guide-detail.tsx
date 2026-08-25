'use client';

import Link from 'next/link';

import type { Guide } from '@/lib/content';
import { useLocale } from '@/lib/i18n/context';
import { ContentEnglishNote } from './content-english-note';
import { Markdown } from './markdown';

export function GuideDetail({ guide }: { guide: Guide }) {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/guides"
        className="text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden="true" className="rtl:-scale-x-100">
          ←
        </span>{' '}
        {t.guideDetail.backLink}
      </Link>

      <div className="mt-6">
        <ContentEnglishNote />
        <Markdown>{guide.body}</Markdown>
      </div>
    </div>
  );
}
