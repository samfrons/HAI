'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';
import { IconExternalLink } from './icons';

function ExternalRef({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-start gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <IconExternalLink
          size={13}
          className="mt-0.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
        />
      </a>
    </li>
  );
}

/**
 * Site-wide footer for the informational pages (playbooks, guides, about) —
 * deliberately absent from the chat surface itself, where the composer stays
 * pinned to the bottom of the viewport and a footer would only compete with it.
 */
export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <h2 className="hai-eyebrow text-subtle">{t.footer.sourcesHeading}</h2>
          <ul className="mt-3 space-y-2">
            <ExternalRef href="https://spherestandards.org/handbook/" label={t.footer.sphereLabel} />
            <ExternalRef href="https://corehumanitarianstandard.org/" label={t.footer.chsLabel} />
            <ExternalRef href="https://interagencystandingcommittee.org/" label={t.footer.iascLabel} />
          </ul>
        </div>

        <div>
          <h2 className="hai-eyebrow text-subtle">{t.footer.dataHeading}</h2>
          <ul className="mt-3 space-y-2">
            <ExternalRef href="https://hapi.humdata.org/" label={t.footer.hdxLabel} />
            <ExternalRef href="https://go.ifrc.org/" label={t.footer.ifrcLabel} />
          </ul>
        </div>

        <div>
          <h2 className="hai-eyebrow text-subtle">{t.footer.docsHeading}</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/playbooks" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.nav.playbooks}
              </Link>
            </li>
            <li>
              <Link href="/guides" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.nav.guides}
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-sm text-muted transition-colors hover:text-foreground">
                {t.nav.about}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto w-full max-w-5xl px-5 py-4 text-xs text-subtle">
          {t.footer.runsOnOpenModels}
        </p>
      </div>
    </footer>
  );
}
