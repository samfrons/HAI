'use client';

import { useLocale } from '@/lib/i18n/context';
import { LOCALES, LOCALE_LABELS, isLocale } from '@/lib/i18n/locales';

/**
 * Compact locale switcher for the header. A native `<select>` rather than a
 * custom dropdown — it comes with keyboard and screen-reader behaviour for
 * free, and at four options a custom menu would only add surface area.
 */
export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted">
      <span className="sr-only">{t.localeSwitcher.label}</span>
      <select
        value={locale}
        onChange={(event) => {
          const { value } = event.target;
          if (isLocale(value)) setLocale(value);
        }}
        className="rounded-md border border-border-subtle bg-surface px-1.5 py-1 text-xs text-foreground transition-colors hover:border-accent-border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
