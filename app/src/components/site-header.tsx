import Link from 'next/link';

import { NavLinks } from './nav-links';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight text-foreground">
            HAI
          </span>
          <span className="hidden text-xs text-subtle sm:inline">
            Humanitarian operations assistant
          </span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
