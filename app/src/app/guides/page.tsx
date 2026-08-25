import Link from 'next/link';
import type { Metadata } from 'next';

import { getGuideIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Guides — HAI',
  description: 'General-purpose guides for prompting, responsible use, and adoption.',
};

export default function GuidesIndexPage() {
  const guides = getGuideIndex();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Guides</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        General-purpose guidance that applies across roles: how to prompt well, how to use AI
        responsibly with humanitarian data, and how to build adoption on your team.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.id}
            href={`/guides/${guide.id}`}
            className="group flex flex-col rounded-xl border border-border-subtle bg-surface p-5 transition-colors hover:border-accent-border hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-sm font-semibold text-foreground">{guide.title}</span>
            <span className="mt-2.5 text-sm leading-relaxed text-muted">{guide.summary}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
