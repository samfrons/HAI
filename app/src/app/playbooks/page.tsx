import Link from 'next/link';
import type { Metadata } from 'next';

import { getPlaybookIcons, getPlaybookIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Playbooks — HAI',
  description: 'Role-specific guidance for using HAI well, with example prompts you can try.',
};

export default function PlaybooksIndexPage() {
  const playbooks = getPlaybookIndex();
  const icons = getPlaybookIcons();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Playbooks</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Role-specific guidance on where HAI genuinely helps, where it shouldn&rsquo;t be used,
        and example prompts you can try — each grounded in why the prompt works, not just what
        to paste.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playbooks.map((playbook) => (
          <Link
            key={playbook.id}
            href={`/playbooks/${playbook.id}`}
            className="group flex flex-col rounded-xl border border-border-subtle bg-surface p-5 transition-colors hover:border-accent-border hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-2xl" aria-hidden="true">
              {icons[playbook.id] ?? '📄'}
            </span>
            <span className="mt-3 text-sm font-semibold text-foreground">{playbook.title}</span>
            <span className="mt-0.5 text-xs font-medium uppercase tracking-wide text-accent">
              {playbook.role}
            </span>
            <span className="mt-2.5 text-sm leading-relaxed text-muted">{playbook.summary}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
