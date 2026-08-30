'use client';

import { useLocale } from '@/lib/i18n/context';

/**
 * The markdown under `content/playbooks` and `content/guides` stays English
 * (translating it is a separate, much larger effort — see the localization
 * report). This note is the honest disclosure for anyone viewing it in a
 * non-English locale, shown only when it's needed.
 */
export function ContentEnglishNote() {
  const { locale, t } = useLocale();
  if (locale === 'en') return null;

  return (
    <p className="mb-4 border border-border-subtle bg-surface-muted px-3 py-2 text-xs text-muted">
      {t.contentEnglishNote}
    </p>
  );
}
