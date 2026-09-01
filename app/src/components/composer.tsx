'use client';

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';

import { useLocale } from '@/lib/i18n/context';

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
}) {
  const { t } = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content instead of scrolling inside a fixed box — field
  // questions are often several lines long.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !value.trim()) return;
    onSubmit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!busy && value.trim()) onSubmit();
    }
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-end gap-2 border border-border-strong bg-surface p-2 transition-colors focus-within:border-accent">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.composer.placeholder}
          aria-label={t.composer.ariaLabel}
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-subtle focus:outline-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="hai-eyebrow shrink-0 border border-border-strong px-3 py-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t.composer.stop}
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="hai-eyebrow shrink-0 bg-accent px-3.5 py-1.5 text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t.composer.send}
          </button>
        )}
      </div>
    </form>
  );
}
