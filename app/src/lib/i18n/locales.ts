/**
 * Supported UI locales for HAI's chrome. This governs interface strings and
 * layout direction only — the model already answers in whatever language the
 * user writes in (see `SYSTEM_PROMPT`), independent of this setting.
 */
export const LOCALES = ['en', 'fr', 'ar', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  es: 'Español',
};

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar']);

export function directionFor(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Best-effort match of a browser language tag ("fr-CA", "ar") to a supported locale. */
export function matchBrowserLocale(tag: string): Locale | undefined {
  const base = tag.split('-')[0].toLowerCase();
  return isLocale(base) ? base : undefined;
}
