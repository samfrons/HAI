import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Markdown } from '@/components/markdown';
import { getAllGuideIds, getGuide } from '@/lib/content';

export function generateStaticParams() {
  return getAllGuideIds().map((id) => ({ id }));
}

export async function generateMetadata(props: PageProps<'/guides/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const guide = getGuide(id);
  if (!guide) return {};
  return {
    title: `${guide.title} — HAI`,
    description: guide.summary,
  };
}

export default async function GuideDetailPage(props: PageProps<'/guides/[id]'>) {
  const { id } = await props.params;
  const guide = getGuide(id);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/guides"
        className="text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        ← All guides
      </Link>

      <div className="mt-6">
        <Markdown>{guide.body}</Markdown>
      </div>
    </div>
  );
}
