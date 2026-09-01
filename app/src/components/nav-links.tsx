'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLocale } from '@/lib/i18n/context';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  const { t } = useLocale();

  const links = [
    { href: '/', label: t.nav.chat },
    { href: '/playbooks', label: t.nav.playbooks },
    { href: '/guides', label: t.nav.guides },
    { href: '/about', label: t.nav.about },
  ] as const;

  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Main">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`hai-eyebrow border-b-2 pb-0.5 transition-colors ${
              active
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
