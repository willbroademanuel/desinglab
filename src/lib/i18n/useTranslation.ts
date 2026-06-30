'use client';

import { useContext } from 'react';
import { LanguageContext } from './LanguageProvider';

/**
 * Convenience hook for accessing the i18n context.
 *
 * Usage:
 * ```tsx
 * const { t, lang, toggleLang } = useTranslation();
 * <p>{t('dashboard.yourPhoto')}</p>
 * ```
 *
 * Throws if used outside LanguageProvider (developer safety).
 */
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error(
      'useTranslation must be used within a <LanguageProvider>. ' +
      'Wrap your dashboard layout with <LanguageProvider>.'
    );
  }
  return ctx;
}
