import type { FeatureTranslation, LocaleSetting, SupportedLocale, TranslationDictionary } from './types';
import { en } from './locales/en';
import { vi } from './locales/vi';

export * from './types';
export { en, vi };

const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en,
  vi,
};

/**
 * Detects the browser UI language.
 * Defaults to 'en' when the environment is unavailable or unrecognized.
 */
export function detectBrowserLocale(): SupportedLocale {
  let lang = 'en';
  if (typeof navigator !== 'undefined') {
    if (typeof navigator.language === 'string') {
      lang = navigator.language.toLowerCase();
    }
  }
  if (lang.startsWith('vi')) {
    return 'vi';
  }
  return 'en';
}

/**
 * Resolves the effective locale from a user setting ('auto', 'en', or 'vi').
 */
export function resolveLocale(setting?: LocaleSetting): SupportedLocale {
  if (setting === 'vi') {
    return 'vi';
  }
  if (setting === 'en') {
    return 'en';
  }
  return detectBrowserLocale();
}

/**
 * Retrieves the translation dictionary for a given locale.
 */
export function getDictionary(locale: SupportedLocale): TranslationDictionary {
  const dict = DICTIONARIES[locale];
  if (dict) {
    return dict;
  }
  return en;
}

/**
 * Looks up translated label and description for a feature key.
 */
export function getFeatureTranslation(
  key: string,
  locale: SupportedLocale,
): FeatureTranslation | undefined {
  const dict = getDictionary(locale);
  const translation = dict.features[key];
  if (translation) {
    return translation;
  }
  return en.features[key];
}
