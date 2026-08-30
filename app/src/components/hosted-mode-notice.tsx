'use client';

import { useLocale } from '@/lib/i18n/context';
import { IconWarning } from './icons';

/**
 * A one-line banner shown only on the public hosted demo.
 *
 * HAI is built to run entirely on the operator's own machine — local model,
 * local database, nothing leaving the laptop — and that property is most of the
 * reason a humanitarian team would trust it with an operational question. The
 * hosted demo trades that away to be clickable from a link, so it has to say so
 * where someone will read it *before* typing, rather than in a README they
 * arrived without.
 *
 * Deliberately styled as chrome and not as an alert: this is a true statement
 * about where the request goes, not a warning that something is wrong.
 */
export function HostedModeNotice() {
  const { t } = useLocale();

  return (
    <div className="border-b border-border-subtle bg-notice-soft/60">
      <p className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-5 py-2 text-center text-xs leading-relaxed text-notice">
        <IconWarning size={13} className="shrink-0" />
        <span>
          <span className="font-semibold">{t.hostedNotice.label}</span> {t.hostedNotice.body}
        </span>
      </p>
    </div>
  );
}
