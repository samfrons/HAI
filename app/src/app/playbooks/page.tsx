import type { Metadata } from 'next';

import { PlaybooksIndex } from '@/components/playbooks-index';
import { getPlaybookIcons, getPlaybookIndex } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Playbooks — HAI',
  description: 'Role-specific guidance for using HAI well, with example prompts you can try.',
};

export default function PlaybooksIndexPage() {
  const playbooks = getPlaybookIndex();
  const icons = getPlaybookIcons();

  return <PlaybooksIndex playbooks={playbooks} icons={icons} />;
}
