import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlaybookDetail } from '@/components/playbook-detail';
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

  return <PlaybookDetail playbook={playbook} />;
}
