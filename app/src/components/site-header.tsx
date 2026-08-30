'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';
import { IconMark } from './icons';
import { LocaleSwitcher } from './locale-switcher';
import { NavLinks } from './nav-links';

export function SiteHeader() {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <IconMark size={14} className="text-accent" />
          <span className="text-base font-bold tracking-tight text-foreground">{t.appName}</span>
          <span className="hidden text-xs text-subtle sm:inline">{t.tagline}</span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <NavLinks />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
