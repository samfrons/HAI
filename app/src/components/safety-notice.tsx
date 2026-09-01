'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';
import { type SafetyNoticeData } from '@/lib/safety/intercept';
import { IconWarning } from './icons';

/**
 * The amber banner on an intercepted message. Advisory, not alarming: the same
 * notice colour the app already uses for retrieval caveats, so it reads as the
 * assistant explaining itself rather than as an error state. The user did not
 * do anything wrong — they hit a near-miss, and the banner's job is to point at
 * the guidance that explains why.
 *
 * The banner chrome (this component) is localized; the finding labels come
 * from the PII-screening module and stay in English, same as the refusal body
 * streamed alongside it — see the localization report for the follow-up.
 */
export function SafetyNotice({ notice }: { notice: SafetyNoticeData }) {
  const { t } = useLocale();

  return (
    <aside className="border border-notice-border bg-notice-soft px-3.5 py-3 text-xs leading-relaxed text-notice">
      <div className="flex items-start gap-2">
        <IconWarning size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-1.5">
          <p className="font-semibold">{t.safetyNotice.title}</p>

          <p className="opacity-90">
            {notice.findings.length === 1
              ? t.safetyNotice.onePattern
              : t.safetyNotice.nPatterns(notice.findings.length)}{' '}
            {t.safetyNotice.screenedSuffix}
          </p>

          <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
            {notice.findings.map((finding, index) => (
              <li key={`${finding.type}-${index}`} className="opacity-90">
                <span className="font-medium">{finding.label}</span>{' '}
                <code className="hai-data bg-notice-border/40 px-1 py-px">{finding.snippet}</code>
              </li>
            ))}
          </ul>

          {notice.principles.length > 0 ? (
            <p className="opacity-90">
              {t.safetyNotice.principlesEngaged} {notice.principles.join(', ')}.
            </p>
          ) : null}

          <p className="pt-0.5">
            <Link
              href={notice.guideHref}
              className="font-medium underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-notice focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t.safetyNotice.readLink}
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
