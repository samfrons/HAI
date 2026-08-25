'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';
import { LocaleSwitcher } from './locale-switcher';
import { NavLinks } from './nav-links';

export function SiteHeader() {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight text-foreground">
            {t.appName}
          </span>
          <span className="hidden text-xs text-subtle sm:inline">{t.tagline}</span>
        </Link>
        <div className="flex items-center gap-3">
          <NavLinks />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
