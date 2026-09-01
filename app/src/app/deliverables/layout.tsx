import { Footer } from '@/components/footer';
import { SiteHeader } from '@/components/site-header';

export default function DeliverablesLayout({ children }: LayoutProps<'/deliverables'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      {/* Wider than the playbooks and guides pages: this one carries a document
          and its trace side by side, and squeezing the trace into a narrow rail
          would make it the footnote it is specifically not meant to be. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      <Footer />
    </div>
  );
}
