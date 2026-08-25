import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GuideDetail } from '@/components/guide-detail';
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

  return <GuideDetail guide={guide} />;
}
