import { SiteHeader } from '@/components/site-header';

export default function GuidesLayout({ children }: LayoutProps<'/guides'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
