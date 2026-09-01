import type { Metadata } from 'next';

import { GuidesIndex } from '@/components/guides-index';
import { getGuideIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Guides — HAI',
  description: 'General-purpose guides for prompting, responsible use, and adoption.',
};

export default function GuidesIndexPage() {
  const guides = getGuideIndex();

  return <GuidesIndex guides={guides} />;
}
