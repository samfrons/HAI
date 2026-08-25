import Link from 'next/link';

import { type SafetyNoticeData } from '@/lib/safety/intercept';

/**
 * The amber banner on an intercepted message. Advisory, not alarming: the same
 * notice colour the app already uses for retrieval caveats, so it reads as the
 * assistant explaining itself rather than as an error state. The user did not
 * do anything wrong — they hit a near-miss, and the banner's job is to point at
 * the guidance that explains why.
 */
export function SafetyNotice({ notice }: { notice: SafetyNoticeData }) {
  return (
    <aside className="rounded-lg border border-notice-border bg-notice-soft px-3.5 py-3 text-xs leading-relaxed text-notice">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="font-semibold">
          &#9888;
        </span>
        <div className="space-y-1.5">
          <p className="font-semibold">Data responsibility — message not processed</p>

          <p className="opacity-90">
            {notice.findings.length === 1
              ? 'One pattern was detected'
              : `${notice.findings.length} patterns were detected`}{' '}
            and screened out before the model saw the message. Nothing was logged
            or stored.
          </p>

          <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
            {notice.findings.map((finding, index) => (
              <li key={`${finding.type}-${index}`} className="opacity-90">
                <span className="font-medium">{finding.label}</span>{' '}
                <code className="rounded bg-notice-border/40 px-1 py-px font-mono">
                  {finding.snippet}
                </code>
              </li>
            ))}
          </ul>

          {notice.principles.length > 0 ? (
            <p className="opacity-90">
              IASC principles engaged: {notice.principles.join(', ')}.
            </p>
          ) : null}

          <p className="pt-0.5">
            <Link
              href={notice.guideHref}
              className="font-medium underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-notice focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Read: Responsible Use of AI in Humanitarian Work
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
