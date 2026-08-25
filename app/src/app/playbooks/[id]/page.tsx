import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ExamplePrompts } from '@/components/example-prompts';
import { Markdown } from '@/components/markdown';
import { getAllPlaybookIds, getPlaybook } from '@/lib/content';

export function generateStaticParams() {
  return getAllPlaybookIds().map((id) => ({ id }));
}

export async function generateMetadata(
  props: PageProps<'/playbooks/[id]'>,
): Promise<Metadata> {
  const { id } = await props.params;
  const playbook = getPlaybook(id);
  if (!playbook) return {};
  return {
    title: `${playbook.title} — HAI`,
    description: playbook.summary,
  };
}

export default async function PlaybookDetailPage(props: PageProps<'/playbooks/[id]'>) {
  const { id } = await props.params;
  const playbook = getPlaybook(id);
  if (!playbook) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/playbooks"
        className="text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        ← All playbooks
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {playbook.icon}
        </span>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          {playbook.role}
        </span>
      </div>

      <div className="mt-6">
        <Markdown>{playbook.intro}</Markdown>
      </div>

      <div className="mt-8">
        <ExamplePrompts examples={playbook.examples} />
      </div>

      <div className="mt-8">
        <Markdown>{playbook.outro}</Markdown>
      </div>
    </div>
  );
}
