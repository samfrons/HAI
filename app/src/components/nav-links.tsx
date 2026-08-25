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
  ] as const;

  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
