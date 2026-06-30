import sw from './sw';
import en from './en';
import { type TranslationKey, type Locale } from './types';

export const translations: Record<Locale, Record<TranslationKey, string>> = { sw, en };
export type { TranslationKey, Locale };

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `\{\{${key}\}\}`));
}
