'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { DICTIONARIES, type Dictionary } from './dictionary';
import {
  DEFAULT_LOCALE,
  directionFor,
  isLocale,
  matchBrowserLocale,
  type Locale,
} from './locales';

const STORAGE_KEY = 'hai-locale';

/**
 * A tiny external store for the active locale, read via `useSyncExternalStore`
 * rather than `useState` + `useEffect`. `localStorage` and `navigator.language`
 * only exist in the browser, so the value can't be computed during the render
 * that also runs on the server — `useSyncExternalStore` is React's sanctioned
 * way to bridge that: it renders `getServerSnapshot` (the default locale)
 * during SSR and initial hydration, then re-renders with the real client
 * snapshot right after, with no manual effect-triggered `setState` involved.
 */
function readStoredLocale(): Locale | undefined {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isLocale(stored) ? stored : undefined;
  } catch {
    // Private browsing / storage disabled — fall through to the default.
    return undefined;
  }
}

let currentLocale: Locale | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): Locale {
  if (currentLocale === undefined) {
    currentLocale = readStoredLocale() ?? matchBrowserLocale(navigator.language) ?? DEFAULT_LOCALE;
  }
  return currentLocale;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publishLocale(next: Locale): void {
  currentLocale = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Nothing to persist to — the in-memory choice for this session still applies.
  }
  for (const listener of listeners) listener();
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionFor(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale: publishLocale, t: DICTIONARIES[locale] }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within a LocaleProvider');
  return context;
}
