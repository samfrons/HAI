'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';

/**
 * Opens the chat with `prompt` prefilled in the composer — via a query param
 * the chat page reads on load — but never auto-submits. The user presses
 * send. That's deliberate: this teaches by having someone complete the
 * action themselves, not by acting on their behalf.
 */
export function TryInChatButton({ prompt }: { prompt: string }) {
  const { t } = useLocale();
  const href = `/?q=${encodeURIComponent(prompt)}`;

  return (
    <Link
      href={href}
      className="hai-eyebrow inline-flex shrink-0 items-center gap-1.5 bg-accent px-3 py-1.5 text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {t.playbookDetail.tryInChat}
      <span aria-hidden="true" className="rtl:-scale-x-100">
        →
      </span>
    </Link>
  );
}
