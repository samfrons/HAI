import type { Metadata } from 'next';

import { AboutContent } from '@/components/about-content';
import { Footer } from '@/components/footer';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'About — HAI',
  description: 'How HAI grounds its answers, screens for data responsibility, and is evaluated.',
};

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <AboutContent />
      </main>
      <Footer />
    </div>
  );
}
