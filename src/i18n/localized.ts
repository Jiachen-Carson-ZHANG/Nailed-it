import type { AppLanguage, LocalizedText } from './types';

export function pickLocalizedText(value: LocalizedText, language: AppLanguage) {
  return value[language];
}
