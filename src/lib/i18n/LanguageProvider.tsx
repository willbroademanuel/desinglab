'use client';

import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { type Locale, type TranslationKey, translations, interpolate } from '@/locales';

const STORAGE_KEY = 'pixtrend-lang';
const DEFAULT_LOCALE: Locale = 'sw';

interface LanguageContextValue {
  /** Current active locale */
  lang: Locale;
  /** Set locale explicitly */
  setLang: (locale: Locale) => void;
  /** Toggle between sw ↔ en */
  toggleLang: () => void;
  /** Translation function — returns translated string for the given key.
   *  Supports interpolation: t('key', { name: 'Ali' }) */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * LanguageProvider — wraps the user dashboard to provide i18n.
 *
 * Design decisions:
 * - Uses cookies for persistence (Server reads cookie -> passes initialLang)
 * - Zero hydration mismatch and no flash of wrong language!
 * - Falls back to English if a Swahili key is missing (safety net)
 * - Memoized context value to prevent unnecessary re-renders
 * - Only wraps dashboard layout — admin is excluded
 */
export function LanguageProvider({ children, initialLang = 'sw' }: { children: React.ReactNode, initialLang?: Locale }) {
  const [lang, setLangState] = useState<Locale>(initialLang);

  const setLang = useCallback((locale: Locale) => {
    setLangState(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = locale;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && stored !== initialLang) {
        setLang(stored);
      } else {
        document.documentElement.lang = lang;
      }
    } catch {
      // ignore
    }
  }, [initialLang, setLang, lang]);

  const toggleLang = useCallback(() => {
    setLang(lang === 'sw' ? 'en' : 'sw');
  }, [lang, setLang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = translations[lang];
      let value = dict[key];

      // Fallback chain: current lang → other lang → key itself
      if (!value) {
        const fallback = translations[lang === 'sw' ? 'en' : 'sw'];
        value = fallback[key] || key;
      }

      if (vars) {
        return interpolate(value, vars);
      }
      return value;
    },
    [lang]
  );

  const contextValue = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  // Prevent flash of wrong language during SSR → hydration
  // The provider still renders children immediately but the context
  // value defaults to Swahili until localStorage is read.
  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}
