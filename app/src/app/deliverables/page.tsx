import type { Metadata } from 'next';

import { Deliverables } from '@/components/deliverables';

export const metadata: Metadata = {
  title: 'Deliverables — HAI',
  description:
    'Generate a country situation brief or a donor report section from live humanitarian data and the standards corpus, with every source consulted and every claim checked shown alongside.',
};

export default function DeliverablesPage() {
  return <Deliverables />;
}
